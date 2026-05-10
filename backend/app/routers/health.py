"""
Saglik kontrolu endpoint'leri (k8s liveness/readiness + monitoring icin).
"""

import time
from fastapi import APIRouter, Depends
from sqlalchemy import text
import httpx
from app.dependencies import get_db
from app.config import settings

router = APIRouter()


@router.get("/live")
def liveness():
    """Process ayakta mi (k8s liveness)."""
    return {"status": "alive"}


@router.get("/ready")
def readiness(db=Depends(get_db)):
    """Tum bagimliliklar hazir mi (k8s readiness)."""
    checks = {"app": "ok"}
    overall_ok = True

    # DB
    t0 = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok", "ms": int((time.perf_counter() - t0) * 1000)}
    except Exception as e:
        overall_ok = False
        checks["database"] = {"status": "error", "error": f"{type(e).__name__}"}

    # Mock pazaryeri API
    t0 = time.perf_counter()
    try:
        with httpx.Client(timeout=3.0) as h:
            r = h.get(f"{settings.MOCK_API_URL}/health")
            checks["mock_api"] = {
                "status": "ok" if r.status_code == 200 else "degraded",
                "ms": int((time.perf_counter() - t0) * 1000),
                "url": settings.MOCK_API_URL,
            }
    except Exception as e:
        overall_ok = False
        checks["mock_api"] = {"status": "error", "error": f"{type(e).__name__}"}

    # Gemini key tanimli mi (gercek ping istersek $ harcariz, sadece config check)
    checks["gemini_configured"] = bool(
        settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here"
    )

    return {
        "status": "ready" if overall_ok else "degraded",
        "env": settings.APP_ENV,
        "checks": checks,
    }
