"""
Kimlik dogrulama endpointleri.
- bcrypt sifre hash (geriye donuk sha256 destegi)
- JWT access + refresh token
- E-posta dogrulama akisi (kod uretir, demo'da log'a yazar)
- Sifre sifirlama akisi (token uretir, demo'da response'ta doner)
"""

import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.dependencies import get_db, get_current_user
from app.db.models import User
from app.config import settings
from app.audit import log_action
from app.security import (
    hash_password, verify_password, needs_rehash,
    create_access_token, create_refresh_token, decode_token,
    generate_verification_code, generate_reset_token,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _now_dt() -> datetime:
    return datetime.now()


def _user_response(user: User, access: str = None, refresh: str = None) -> dict:
    out = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "store_name": user.store_name,
        "email_verified": user.email_verified,
        "created_at": user.created_at,
    }
    if access:
        out["access_token"] = access
        out["token_type"] = "bearer"
        out["expires_in"] = settings.JWT_ACCESS_TOKEN_TTL_MINUTES * 60
    if refresh:
        out["refresh_token"] = refresh
    return out


# ---- Request models ----

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    store_name: str = Field("", max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    store_name: Optional[str] = Field(None, max_length=120)


class RefreshRequest(BaseModel):
    refresh_token: str


class SendVerificationRequest(BaseModel):
    email: EmailStr


class ConfirmVerificationRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=10)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=8, max_length=128)


# ---- Endpoints ----

@router.post("/register", status_code=201)
def register(req: RegisterRequest, db=Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayitli")

    user = User(
        name=req.name,
        email=req.email,
        password=hash_password(req.password),
        store_name=req.store_name,
        email_verified=False,
        verification_code=generate_verification_code(),
        created_at=datetime.now().strftime("%Y-%m-%d"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Production'da burada SendGrid/SMTP cagrisi olur. Demo'da log'a yaziyoruz.
    logger.info(f"[EMAIL STUB] {user.email} dogrulama kodu: {user.verification_code}")

    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token(user.id)
    return {
        "message": "Kayit basarili. E-posta dogrulama kodu gonderildi.",
        "user": _user_response(user, access, refresh),
        # Demo kolayligi icin kodu da donduruyoruz; production'da kaldirilmali.
        "demo_verification_code": user.verification_code if settings.APP_ENV == "development" else None,
    }


@router.post("/login")
def login(req: LoginRequest, request: Request, db=Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        log_action(db, user.id if user else None, "login_failed",
                   details={"email": req.email}, request=request)
        db.commit()
        raise HTTPException(status_code=401, detail="E-posta veya sifre hatali")

    if needs_rehash(user.password):
        user.password = hash_password(req.password)

    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token(user.id)
    log_action(db, user.id, "login_success", request=request)
    db.commit()

    return {
        "message": "Giris basarili",
        "user": _user_response(user, access, refresh),
    }


@router.post("/refresh")
def refresh_access_token(req: RefreshRequest, db=Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if not payload or (isinstance(payload, dict) and payload.get("_error") == "expired"):
        raise HTTPException(status_code=401, detail="Gecersiz veya suresi dolmus refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token tipi gecersiz (refresh bekleniyor)")

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Bozuk token payload")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanici bulunamadi")

    access = create_access_token(user.id, user.email)
    return {
        "access_token": access,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_TTL_MINUTES * 60,
    }


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return _user_response(user)


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    if not verify_password(req.current_password, user.password):
        raise HTTPException(status_code=401, detail="Mevcut sifre hatali")

    db_user = db.query(User).filter(User.id == user.id).first()
    db_user.password = hash_password(req.new_password)
    new_access = create_access_token(db_user.id, db_user.email)
    new_refresh = create_refresh_token(db_user.id)
    db.commit()

    return {
        "message": "Sifre guncellendi",
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


@router.put("/update-profile")
def update_profile(
    req: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    db_user = db.query(User).filter(User.id == user.id).first()

    if req.email and req.email != db_user.email:
        if db.query(User).filter(User.email == req.email).first():
            raise HTTPException(status_code=400, detail="Bu e-posta baska bir kullaniciya ait")
        db_user.email = req.email
        db_user.email_verified = False
        db_user.verification_code = generate_verification_code()
        logger.info(f"[EMAIL STUB] {db_user.email} yeni dogrulama kodu: {db_user.verification_code}")

    if req.name is not None:
        db_user.name = req.name
    if req.store_name is not None:
        db_user.store_name = req.store_name

    db.commit()
    db.refresh(db_user)
    return {"message": "Profil guncellendi", "user": _user_response(db_user)}


# ---- E-posta dogrulama ----

@router.post("/verify-email")
def send_verification(req: SendVerificationRequest, db=Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    # Bilgi sizdirmamak icin: kullanici yoksa bile basarili gibi cevap dondur
    if not user:
        return {"message": "Eger e-posta kayitli ise dogrulama kodu gonderildi."}
    if user.email_verified:
        return {"message": "E-posta zaten dogrulanmis"}

    user.verification_code = generate_verification_code()
    db.commit()
    logger.info(f"[EMAIL STUB] {user.email} dogrulama kodu: {user.verification_code}")
    return {
        "message": "Dogrulama kodu gonderildi",
        "demo_code": user.verification_code if settings.APP_ENV == "development" else None,
    }


@router.post("/verify-email/confirm")
def confirm_verification(req: ConfirmVerificationRequest, db=Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not user.verification_code or user.verification_code != req.code:
        raise HTTPException(status_code=400, detail="Gecersiz dogrulama kodu")

    user.email_verified = True
    user.verification_code = None
    db.commit()
    return {"message": "E-posta dogrulandi"}


# ---- Sifre sifirlama ----

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db=Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # Hesap enumeration onlemek icin her zaman ayni cevap
        return {"message": "Eger e-posta kayitli ise sifirlama linki gonderildi."}

    reset_token = generate_reset_token()
    # Token'i users tablosunda gecici depola (verification_code field'ini reuse ediyoruz
    # alternatif: ayri password_reset_tokens tablosu — daha temiz)
    user.verification_code = f"RESET:{reset_token}:{(datetime.now() + timedelta(hours=1)).isoformat()}"
    db.commit()
    logger.info(f"[EMAIL STUB] {user.email} sifirlama linki: /reset?token={reset_token}")
    return {
        "message": "Sifirlama linki gonderildi",
        "demo_reset_token": reset_token if settings.APP_ENV == "development" else None,
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db=Depends(get_db)):
    user = (
        db.query(User)
        .filter(User.verification_code.like(f"RESET:{req.reset_token}:%"))
        .first()
    )
    if not user:
        raise HTTPException(status_code=400, detail="Gecersiz sifirlama token'i")

    # Suresi geçmis mi?
    try:
        _, _, exp_iso = user.verification_code.split(":", 2)
        if datetime.fromisoformat(exp_iso) < datetime.now():
            raise HTTPException(status_code=400, detail="Sifirlama token'i suresi dolmus")
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Bozuk sifirlama token'i")

    user.password = hash_password(req.new_password)
    user.verification_code = None
    db.commit()
    return {"message": "Sifre sifirlandi. Yeniden giris yapin."}
