"""Application configuration using pydantic-settings."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    ENVIRONMENT: str = "development"
    APP_NAME: str = "Audio Blog Platform API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # Firebase
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""
    FIREBASE_STORAGE_BUCKET: str = ""

    # Google Cloud
    GCP_PROJECT_ID: str = ""
    GCS_AUDIO_BUCKET: str = ""
    GCS_IMAGE_BUCKET: str = ""
    TTS_MAX_CONCURRENT: int = 5
    TTS_CHUNK_MAX_BYTES: int = 4500
    TTS_DEFAULT_VOICE: str = "ja-JP-Neural2-B"
    TTS_DEFAULT_LANGUAGE: str = "ja-JP"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    PLATFORM_FEE_PERCENT: float = 20.0

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Rate Limiting
    RATE_LIMIT_AUTHENTICATED: int = 100
    RATE_LIMIT_UNAUTHENTICATED: int = 20
    RATE_LIMIT_TTS: int = 10
    RATE_LIMIT_ADMIN: int = 200
    RATE_LIMIT_WEBHOOK: int = 1000
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # Signed URL
    SIGNED_URL_EXPIRY_SECONDS: int = 3600

    # Sentry
    SENTRY_DSN: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT == "test"


@lru_cache
def get_settings() -> Settings:
    return Settings()
