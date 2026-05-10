"""
FastAPI dependency'leri.
- get_current_user: Once Authorization Bearer JWT'yi dener,
  yoksa ?token= query parametresine (legacy) duser.
- get_db: tutarli session yonetimi
"""

from fastapi import HTTPException, Query, Request, Depends
from typing import Optional
from app.db.database import SessionLocal
from app.db.models import User
from app.security import decode_token


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _extract_token(request: Request, query_token: Optional[str]) -> Optional[str]:
    """Bearer header > query param sirasiyla token ara."""
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return query_token


def get_current_user(
    request: Request,
    token: Optional[str] = Query(None, description="Legacy ?token=. Production'da Authorization: Bearer kullan."),
    db=Depends(get_db),
) -> User:
    raw_token = _extract_token(request, token)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Token gerekli (Authorization: Bearer veya ?token=)")

    # 1) JWT cozumlemeyi dene
    payload = decode_token(raw_token)
    if isinstance(payload, dict) and payload.get("_error") == "expired":
        raise HTTPException(status_code=401, detail="Token suresi dolmus, yeniden giris yapin")

    if payload and "sub" in payload:
        try:
            user_id = int(payload["sub"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=401, detail="Gecersiz token")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="Kullanici bulunamadi")
        return user

    # 2) Legacy: users.token field'i ile lookup (demo-token, eski client'lar)
    user = db.query(User).filter(User.token == raw_token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Gecersiz token")
    return user


def get_current_user_optional(
    request: Request,
    token: Optional[str] = Query(None),
    db=Depends(get_db),
) -> Optional[User]:
    """Auth zorunlu degilse (public/health endpoint'leri)."""
    raw_token = _extract_token(request, token)
    if not raw_token:
        return None
    try:
        return get_current_user(request=request, token=token, db=db)
    except HTTPException:
        return None
