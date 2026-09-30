from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Equili API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    EMAIL_VERIFY_TOKEN_EXPIRE_HOURS: int = 24

    # GitHub Models (LLM) — variáveis legadas, mantidas para compatibilidade (ex: assistente de voz)
    GITHUB_TOKEN: str = ""
    GITHUB_MODELS_ENDPOINT: str = "https://models.inference.ai.azure.com"
    GITHUB_MODELS_MODEL: str = "gpt-4o-mini"

    # GitHub Models (https://models.github.ai/) — API compatível com OpenAI
    GITHUB_MODELS_BASE_URL: str = "https://models.github.ai/inference/v1"
    GITHUB_MODELS_API_KEY: str = ""
    GITHUB_MODELS_CHAT_MODEL: str = ""

    @model_validator(mode="after")
    def _fallback_github_models_api_key(self) -> "Settings":
        # Compatibilidade: se GITHUB_MODELS_API_KEY não foi definido, reaproveita GITHUB_TOKEN
        if not self.GITHUB_MODELS_API_KEY and self.GITHUB_TOKEN:
            self.GITHUB_MODELS_API_KEY = self.GITHUB_TOKEN
        return self

    # Email (Resend)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@equili.app"

    # Frontend URL (para CORS)
    FRONTEND_URL: str = "https://equili.com.br"
    ALLOWED_ORIGINS: list[str] = [
        "https://equili.com.br",
        "https://www.equili.com.br",
    ]

    @field_validator("FRONTEND_URL")
    @classmethod
    def validate_frontend_url(cls, value: str) -> str:
        if value == "*":
            raise ValueError("FRONTEND_URL não pode ser '*' em produção.")
        return value

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def validate_allowed_origins(cls, value):
        if isinstance(value, str):
            value = [origin.strip() for origin in value.split(",") if origin.strip()]
        if "*" in value:
            raise ValueError("ALLOWED_ORIGINS não pode conter '*'.")
        return value

    # Limites do plano gratuito
    PLANO_GRATIS_MAX_DIVIDAS: int = 3
    PLANO_GRATIS_MAX_PLANOS_IA_MES: int = 3

    # Web Push / VAPID
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY_B64: str = ""
    VAPID_SUBJECT: str = "mailto:suporte@equili.app"

    # Social Auth
    GOOGLE_CLIENT_ID: str = ""  # ex: 123456789-xxx.apps.googleusercontent.com
    APPLE_ALLOWED_AUDIENCES: str = "com.equili.app"  # CSV: com.equili.app,com.equili.web

    # Rate limiting de IA
    RATE_LIMIT_AI_REQUESTS: int = 20
    RATE_LIMIT_AI_WINDOW_SECONDS: int = 60
    REDIS_URL: str = ""

    # Rastro (observabilidade)
    RASTRO_ENABLED: bool = False
    RASTRO_INGEST_URL: str = "http://localhost:4000/ingest/errors"
    RASTRO_INGEST_TOKEN: str = ""
    RASTRO_ORGANIZATION_SLUG: str = "acme"
    RASTRO_PROJECT_SLUG: str = "equili"
    RASTRO_ENVIRONMENT: str = "development"
    RASTRO_RELEASE: str = "dev"


settings = Settings()
