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
    # Tek-key (legacy / fallback). Yeni pool degiskenlerinden hicbiri tanimli
    # degilse bu key tum cagrilara DEFAULT pool olarak servis edilir.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # --- AliExpress Affiliate API ---
    # Kayıt: https://portals.aliexpress.com/ → Publisher → Tools → API Access
    ALIEXPRESS_APP_KEY: str = ""
    ALIEXPRESS_APP_SECRET: str = ""
    # --- Gemini API key havuzlari (purpose-based pools) ---
    # Virgulle ayrilmis key listesi. Bos = ilgili pool DEFAULT'a fallback eder.
    # 429 (quota) durumunda pool icinde round-robin ile sonraki key denenir.
    GEMINI_API_KEYS_AGENTS_RAW: str = Field(default="", alias="GEMINI_API_KEYS_AGENTS")
    GEMINI_API_KEYS_CHAT_RAW: str = Field(default="", alias="GEMINI_API_KEYS_CHAT")
    GEMINI_API_KEYS_ANALYZE_RAW: str = Field(default="", alias="GEMINI_API_KEYS_ANALYZE")
    GEMINI_API_KEYS_VISION_RAW: str = Field(default="", alias="GEMINI_API_KEYS_VISION")
    GEMINI_API_KEYS_DEFAULT_RAW: str = Field(default="", alias="GEMINI_API_KEYS_DEFAULT")

    @staticmethod
    def _parse_key_list(raw: str) -> List[str]:
        return [k.strip() for k in (raw or "").split(",") if k.strip()]

    @property
    def GEMINI_API_KEYS_AGENTS(self) -> List[str]:
        return self._parse_key_list(self.GEMINI_API_KEYS_AGENTS_RAW)

    @property
    def GEMINI_API_KEYS_CHAT(self) -> List[str]:
        return self._parse_key_list(self.GEMINI_API_KEYS_CHAT_RAW)

    @property
    def GEMINI_API_KEYS_ANALYZE(self) -> List[str]:
        return self._parse_key_list(self.GEMINI_API_KEYS_ANALYZE_RAW)

    @property
    def GEMINI_API_KEYS_VISION(self) -> List[str]:
        return self._parse_key_list(self.GEMINI_API_KEYS_VISION_RAW)

    @property
    def GEMINI_API_KEYS_DEFAULT(self) -> List[str]:
        """Default pool. Bos ise tek-key GEMINI_API_KEY'i tek elemanli liste yapar."""
        keys = self._parse_key_list(self.GEMINI_API_KEYS_DEFAULT_RAW)
        if keys:
            return keys
        if self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip() and self.GEMINI_API_KEY != "your_gemini_api_key_here":
            return [self.GEMINI_API_KEY.strip()]
        return []

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

    # --- Gunluk otonom cevap taslagi uretimi ---
    # AGENT_INTERVAL_SECONDS'tan bagimsiz: gunde bir kez negatif yorumlara cevap
    # taslaklarini arka planda uretir (tam ajan pipeline'ini calistirmaz, quota dostu).
    DAILY_DRAFT_ENABLED: bool = True
    DAILY_DRAFT_INTERVAL_SECONDS: int = 86400  # 24 saat

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: Literal["json", "text"] = "json"

    # --- Security ---
    # Eski sha256-hashli sifreleri kabul et (login'de transparent rehash yapilir).
    # Production'da, migration bittikten sonra false yapilmalidir.
    ALLOW_LEGACY_SHA256_PASSWORDS: bool = True


settings = Settings()
