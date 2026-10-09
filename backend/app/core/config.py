from pydantic import field_validator
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

    # OpenRouter (LLM) — API compatível com OpenAI (https://openrouter.ai)
    # Modelos gratuitos têm sufixo `:free` — veja https://openrouter.ai/models?max_price=0
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_API_KEY: str = ""
    # Primário: forte e rápido; o fallback deve ser de outro vendor e também suportar
    # response_format (JSON mode), obrigatório para o Plano de Ação.
    OPENROUTER_CHAT_MODEL: str = "nvidia/nemotron-3-super-120b-a12b:free"
    OPENROUTER_FALLBACK_MODEL: str = "google/gemma-4-26b-a4b-it:free"
    # Desliga o "thinking" dos modelos de raciocínio para não consumir o max_tokens e
    # truncar o JSON. Se o modelo exigir reasoning, o cliente reenvia sem o parâmetro.
    OPENROUTER_DISABLE_REASONING: bool = True

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
