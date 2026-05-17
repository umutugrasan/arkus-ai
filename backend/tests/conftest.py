"""
Pytest fixtures + test ortami setup.

Onemli: app.config'i import etmeden ONCE env'i hazirla; aksi halde pydantic-settings
production defaults'i okur ve testler izole calismaz.
"""

import os
import sys
import tempfile
from pathlib import Path

# Env override — config import edilmeden once
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("JWT_SECRET", "ci-test-secret-32-chars-min-length-ok")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("AGENT_INTERVAL_SECONDS", "0")
os.environ.setdefault("CORS_ORIGINS", "*")

# SQLite test DB — her test run icin temiz dosya
_test_db = Path(tempfile.gettempdir()) / "arkus_pytest.db"
if _test_db.exists():
    _test_db.unlink()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_test_db.as_posix()}")

# backend/ kokunu sys.path'a ekle ki "app" import edilebilsin (pytest cwd: backend)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    """
    Tum testlerin paylastigi TestClient. Lifespan hook'lari (DB create_all, seed,
    scheduler) calisir ama seed mock-api'ye HTTP atmaz cunku no_seed monkey patch'i
    altinda.
    """
    # Mock-api'ye HTTP atan seed'i no-op'la
    from app.db import seed as seed_module

    def _no_seed(db):
        return None

    def _no_refresh(db):
        return None

    seed_module.seed_db = _no_seed
    seed_module.refresh_demo_dates = _no_refresh

    # Scheduler env'den zaten 0; ekstra guvenlik icin no-op
    from app.agents import scheduler as sched_module

    def _no_start():
        return None

    def _no_stop():
        return None

    sched_module.start_scheduler = _no_start
    sched_module.stop_scheduler = _no_stop

    # main.py'i import et — yukaridaki patch'ler sonrasinda
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_token(client):
    """Test kullanicisi register et + login token dondur."""
    email = "smoketest@arkus.ai"
    password = "smoketest123"
    # Idempotent register: 400 = zaten varsa OK
    r = client.post("/api/v1/auth/register", json={
        "name": "Smoke Test",
        "email": email,
        "password": password,
        "store_name": "Smoke Store",
    })
    assert r.status_code in (201, 400), f"register beklenmeyen: {r.status_code} {r.text}"

    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login basarisiz: {r.text}"
    token = r.json()["user"]["access_token"]
    return token
