"""
Auth + crypto yardimcilar.
- bcrypt ile sifre hashleme (SHA-256 yerine)
- JWT access + refresh token uretme/dogrulama
- E-posta dogrulama kodu uretme
- Sifre sifirlama token'i uretme
"""

import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from app.config import settings


# ---- Password hashing (bcrypt) ----

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        # Eski sha256 hash'lerine geriye donuk uyumluluk: 64 hex char ise sha256
        if len(hashed) == 64 and all(c in "0123456789abcdef" for c in hashed):
            import hashlib
            return hashlib.sha256(plain.encode()).hexdigest() == hashed
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def needs_rehash(hashed: str) -> bool:
    """sha256 ile saklanmis eski parolayi bcrypt'e yukseltmek icin login sonrasi cagrilir."""
    if not hashed:
        return False
    return len(hashed) == 64 and all(c in "0123456789abcdef" for c in hashed)


# ---- JWT ----

def create_access_token(user_id: int, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_REFRESH_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return {"_error": "expired"}
    except jwt.InvalidTokenError:
        return None


# ---- Codes / random tokens ----

def generate_verification_code(length: int = 6) -> str:
    """6 haneli sayisal e-posta dogrulama kodu."""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def generate_reset_token() -> str:
    """Sifre sifirlama icin URL-safe random token."""
    return secrets.token_urlsafe(32)
