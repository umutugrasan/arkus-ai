"""
Basiret AI — Ana FastAPI giris noktasi.
- Yapilandirilmis loglama + request ID middleware
- Env-driven CORS
- slowapi rate limiting
- v1 API versiyonlama (/api/v1/...)
- Lifespan: DB migrate (create_all), seed (idempotent), agent scheduler start/stop
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.gzip import GZipMiddleware

from app.config import settings
from app.logging_config import setup_logging, RequestContextMiddleware
from app.rate_limit import limiter
from app.db.database import engine, Base, SessionLocal
from app.db.seed import seed_db
from app.agents.scheduler import start_scheduler, stop_scheduler
from app.routers import (
    auth, store, dashboard, products, reviews,
    competitors, arbitrage, financials, health_score,
    finance_guide, sourcing, chat, notifications, reports,
    listing_optimizer, image_analyzer, agents,
    health, uploads,
)


setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Basiret AI baslatiliyor (env={settings.APP_ENV})")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()

    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Basiret AI kapatildi")


app = FastAPI(
    title="Basiret AI - Satici Zekasi API",
    description=(
        "Coklu pazaryeri satici analiz ve danismanlik platformu.\n\n"
        "**Auth:** Authorization: Bearer <jwt> (onerilen) veya ?token= (legacy)."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# --- Middleware (sira onemli: response giderken tersi calistirilir) ---
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


# --- Rate limit ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- Saglik endpoint'leri (auth gerekmez, monitoring icin) ---
app.include_router(health.router, prefix="/health", tags=["Saglik"])


# --- API router'lari (yalnizca /api/v1) ---
API_PREFIX = "/api/v1"


def _include(router, path: str, tag: str):
    app.include_router(router, prefix=f"{API_PREFIX}{path}", tags=[tag])


_include(auth.router, "/auth", "Kimlik Dogrulama")
_include(store.router, "/store", "Magaza Yonetimi")
_include(dashboard.router, "/dashboard", "Dashboard")
_include(products.router, "/products", "Urun Yonetimi")
_include(reviews.router, "/reviews", "Yorum Analizi")
_include(competitors.router, "/competitors", "Rakip Analizi")
_include(arbitrage.router, "/arbitrage", "Arbitraj")
_include(financials.router, "/financials", "Finansal Analiz")
_include(health_score.router, "/health-score", "Saglik Skoru")
_include(finance_guide.router, "/finance-guide", "Finansman Yonlendirme")
_include(sourcing.router, "/sourcing", "Tedarik Avcisi")
_include(chat.router, "/chat", "AI Danismann")
_include(notifications.router, "/notifications", "Bildirimler")
_include(reports.router, "/reports", "Raporlar")
_include(listing_optimizer.router, "/listing-optimizer", "Listeleme Optimizasyonu")
_include(image_analyzer.router, "/image-analyzer", "Gorsel Analizi")
_include(agents.router, "/agents", "Otonom Ajanlar")
_include(uploads.router, "/uploads", "Yukleme")


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "env": settings.APP_ENV,
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": API_PREFIX,
    }
