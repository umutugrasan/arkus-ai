"""
Audit log yardimcisi.
Kritik aksiyonlari (login, key change, sync, password reset) DB'ye yazar.
"""

from datetime import datetime
from typing import Optional
from fastapi import Request
from app.db.models import AuditLog


def log_action(
    db,
    user_id: Optional[int],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
):
    ip = None
    ua = None
    if request:
        ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
        ua = request.headers.get("user-agent")
    db.add(AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        details=details,
        ip=ip,
        user_agent=(ua[:240] if ua else None),
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    ))
    # commit caller'a birakildi (transaction batch'leri icin)
