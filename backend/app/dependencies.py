"""
FastAPI dependency'leri.
- get_current_user: yalnizca Authorization: Bearer <JWT> kabul eder.
- get_db: tutarli session yonetimi.
"""

from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.db.database import SessionLocal
from app.db.models import User
from app.security import decode_token


bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token (login response'taki access_token)")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db=Depends(get_db),
) -> User:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Authorization: Bearer <token> gerekli")
    payload = decode_token(creds.credentials)
    if isinstance(payload, dict) and payload.get("_error") == "expired":
        raise HTTPException(status_code=401, detail="Token suresi dolmus, /auth/refresh ile yenile")
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Gecersiz token")
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Bozuk token payload")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanici bulunamadi")
    return user


def get_current_user_optional(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db=Depends(get_db),
) -> Optional[User]:
    if not creds or not creds.credentials:
        return None
    try:
        return get_current_user(creds=creds, db=db)
    except HTTPException:
        return None
