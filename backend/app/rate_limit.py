"""
slowapi tabanli rate limiter.
- Kullanici bazli (token icindeki sub) limit
- AI endpoint'leri icin daha sert limit (Gemini maliyet kontrolu)
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
from app.security import decode_token


def _key_from_request(request: Request) -> str:
    """Token icindeki user_id'yi key olarak kullan, yoksa IP."""
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        payload = decode_token(auth.split(" ", 1)[1].strip())
        if payload and "sub" in payload and not (isinstance(payload, dict) and payload.get("_error")):
            return f"user:{payload['sub']}"
    qt = request.query_params.get("token")
    if qt:
        payload = decode_token(qt)
        if payload and "sub" in payload and not (isinstance(payload, dict) and payload.get("_error")):
            return f"user:{payload['sub']}"
    return get_remote_address(request)


limiter = Limiter(key_func=_key_from_request)
