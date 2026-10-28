from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    nome: str
    email: EmailStr
    senha: str

    @field_validator("senha")
    @classmethod
    def senha_forte(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("A senha deve ter no mínimo 8 caracteres.")
        if not any(c.isupper() for c in v):
            raise ValueError("A senha deve conter ao menos uma letra maiúscula.")
        if not any(c.isdigit() for c in v):
            raise ValueError("A senha deve conter ao menos um número.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email_verificado: bool = False
    verification_required: bool = False
    # Preenchido apenas quando o cliente é o app nativo: o WebView do app roda
    # em capacitor://localhost (iOS) / https://localhost (Android) e não lê nem
    # envia os cookies de refresh/CSRF do domínio equili.com.br. Nesses casos o
    # refresh token vai no corpo da resposta e é guardado no Keychain/Keystore.
    refresh_token: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=20, max_length=4096)


class EmailVerificationRequest(BaseModel):
    token: str


class EmailResendRequest(BaseModel):
    email: EmailStr
