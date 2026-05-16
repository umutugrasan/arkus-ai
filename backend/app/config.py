"""
Merkezi config — tum env var'lar burada toplaniyor.

Pydantic BaseSettings ile:
  - Tip donusumu otomatik (int/float/bool/list)
  - Bos/eksik kritik env'ler icin field_validator hatalari
  - .env dosyasi destegi (python-dotenv araciligi ile)

Production'da .env, secrets manager veya container env doldurur.
"""

from typing import List, Literal

from pydantic import Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# JWT_SECRET icin guvensiz/varsayilan degerler. APP_ENV=production iken bunlardan
# biri kullaniliyorsa boot'ta crash veriyoruz.
_INSECURE_JWT_DEFAULTS = {
    "change-me-in-production-very-secret-32+chars",
    "change-me",
    "secret",
    "",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Genel ---
    APP_NAME: str = "Arkus AI"
    APP_ENV: Literal["development", "staging", "production"] = "development"

    @property
    def DEBUG(self) -> bool:
        return self.APP_ENV != "production"

    # --- Database ---
    DATABASE_URL: str = "postgresql://arkus:arkuspassword@localhost:5432/arkus_db"

    # --- Auth / JWT ---
    JWT_SECRET: str = "change-me-in-production-very-secret-32+chars"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_TTL_MINUTES: int = Field(default=60, alias="JWT_ACCESS_TTL_MIN")
    JWT_REFRESH_TOKEN_TTL_DAYS: int = Field(default=30, alias="JWT_REFRESH_TTL_DAYS")

    @field_validator("JWT_SECRET")
    @classmethod
    def _jwt_secret_must_be_strong_in_production(cls, v: str, info: ValidationInfo) -> str:
        env = info.data.get("APP_ENV", "development")
        if env == "production" and v.strip() in _INSECURE_JWT_DEFAULTS:
            raise ValueError(
                "JWT_SECRET production'da varsayilan/zayif deger olamaz. "
                "Env var olarak guclu (32+ karakter, rastgele) bir deger ayarla."
            )
        return v

    # --- CORS ---
    CORS_ORIGINS_RAW: str = Field(default="*", alias="CORS_ORIGINS")

    @property
    def CORS_ORIGINS(self) -> List[str]:
        raw = self.CORS_ORIGINS_RAW
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    # --- Mock pazaryeri API ---
    MOCK_API_URL: str = Field(default="http://mock-api:8001", alias="MOCK_MARKETPLACE_API_URL")

    # --- Gemini ---
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # --- Rate limit ---
    RATE_LIMIT_AI_PER_MIN: str = "10/minute"
    RATE_LIMIT_DEFAULT_PER_MIN: str = "60/minute"

    # --- Agent thresholds ---
    LOW_STOCK_DAYS: int = 15
    LOW_STOCK_CRITICAL_DAYS: int = 7
    LOW_RATING_THRESHOLD: float = 4.0
    LOW_RATING_MIN_REVIEWS: int = 50
    COMPETITOR_PRICE_CHANGE_PCT: float = 3.0
    COMPETITOR_PRICE_WARNING_PCT: float = 5.0
    NEGATIVE_REVIEW_THRESHOLD_PCT: float = 40.0

    # --- Agent scheduler ---
    AGENT_INTERVAL_SECONDS: int = 3600

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: Literal["json", "text"] = "json"

    # --- Security ---
    # Eski sha256-hashli sifreleri kabul et (login'de transparent rehash yapilir).
    # Production'da, migration bittikten sonra false yapilmalidir.
    ALLOW_LEGACY_SHA256_PASSWORDS: bool = True


settings = Settings()
