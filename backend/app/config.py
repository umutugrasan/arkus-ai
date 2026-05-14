"""
Merkezi config — tum env var'lar burada toplaniyor.
Production'da .env veya secrets manager doldurur.
"""

import os
from typing import List


class Settings:
    # --- Genel ---
    APP_NAME: str = "Arkus AI"
    APP_ENV: str = os.getenv("APP_ENV", "development")  # development | production
    DEBUG: bool = APP_ENV == "development"

    # --- Database ---
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://arkus:arkuspassword@localhost:5432/arkus_db",
    )

    # --- Auth / JWT ---
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production-very-secret-32+chars")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_TTL_MINUTES: int = int(os.getenv("JWT_ACCESS_TTL_MIN", "60"))
    JWT_REFRESH_TOKEN_TTL_DAYS: int = int(os.getenv("JWT_REFRESH_TTL_DAYS", "30"))

    # --- CORS ---
    @property
    def CORS_ORIGINS(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", "*")
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    # --- Mock pazaryeri API ---
    MOCK_API_URL: str = os.getenv("MOCK_MARKETPLACE_API_URL", "http://mock-api:8001")

    # --- Gemini ---
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # --- Rate limit ---
    RATE_LIMIT_AI_PER_MIN: str = os.getenv("RATE_LIMIT_AI_PER_MIN", "10/minute")
    RATE_LIMIT_DEFAULT_PER_MIN: str = os.getenv("RATE_LIMIT_DEFAULT_PER_MIN", "60/minute")

    # --- Agent thresholds (notifications + agents config olmali) ---
    LOW_STOCK_DAYS: int = int(os.getenv("LOW_STOCK_DAYS", "15"))
    LOW_STOCK_CRITICAL_DAYS: int = int(os.getenv("LOW_STOCK_CRITICAL_DAYS", "7"))
    LOW_RATING_THRESHOLD: float = float(os.getenv("LOW_RATING_THRESHOLD", "4.0"))
    LOW_RATING_MIN_REVIEWS: int = int(os.getenv("LOW_RATING_MIN_REVIEWS", "50"))
    COMPETITOR_PRICE_CHANGE_PCT: float = float(os.getenv("COMPETITOR_PRICE_CHANGE_PCT", "3.0"))
    COMPETITOR_PRICE_WARNING_PCT: float = float(os.getenv("COMPETITOR_PRICE_WARNING_PCT", "5.0"))
    NEGATIVE_REVIEW_THRESHOLD_PCT: float = float(os.getenv("NEGATIVE_REVIEW_THRESHOLD_PCT", "40.0"))

    # --- Agent scheduler ---
    AGENT_INTERVAL_SECONDS: int = int(os.getenv("AGENT_INTERVAL_SECONDS", "3600"))

    # --- Logging ---
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv("LOG_FORMAT", "json")  # json | text


settings = Settings()
