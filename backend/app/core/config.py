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

    # GitHub Models (LLM)
    GITHUB_TOKEN: str = ""
    GITHUB_MODELS_ENDPOINT: str = "https://models.inference.ai.azure.com"
    GITHUB_MODELS_MODEL: str = "gpt-4o-mini"

    # Email (Resend)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@equili.app"

    # Frontend URL (para CORS)
    FRONTEND_URL: str = "http://localhost:5173"

    # Limites do plano gratuito
    PLANO_GRATIS_MAX_DIVIDAS: int = 3
    PLANO_GRATIS_MAX_PLANOS_IA_MES: int = 3

    # Web Push / VAPID
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY_B64: str = ""
    VAPID_SUBJECT: str = "mailto:suporte@equili.app"

    # Evolution API (WhatsApp)
    EVOLUTION_API_URL: str = ""        # ex: https://evo.equili.com.br
    EVOLUTION_API_KEY: str = ""        # API key global da Evolution API
    EVOLUTION_INSTANCE: str = "equili" # nome da instância criada na Evolution API
    WHATSAPP_WEBHOOK_SECRET: str = ""  # token para validar chamadas do webhook


settings = Settings()
