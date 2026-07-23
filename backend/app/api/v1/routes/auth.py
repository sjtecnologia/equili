import secrets
import logging

from fastapi import APIRouter, Cookie, Header, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.config import settings
from app.core.dependencies import DBSession
from app.core.rastro_client import rastro_client
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

import httpx
import os

router = APIRouter()
logger = logging.getLogger(__name__)

REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"

def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )


def _set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=CSRF_COOKIE,
        value=token,
        httponly=False,
        secure=True,
        samesite="strict",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )


def _issue_session_cookies(response: Response, refresh_token: str) -> None:
    _set_refresh_cookie(response, refresh_token)
    _set_csrf_cookie(response, secrets.token_urlsafe(32))


def _validate_csrf(origin: str | None, csrf_cookie: str | None, csrf_header: str | None) -> None:
    if origin and origin.rstrip("/") != settings.FRONTEND_URL.rstrip("/"):
        raise HTTPException(status_code=403, detail="Origem inválida.")

    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(status_code=403, detail="CSRF token inválido.")


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
async def register(data: RegisterRequest, response: Response, db: DBSession):
    # Verificar email duplicado
    result = await db.execute(select(Usuario).where(Usuario.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email já cadastrado.")

    usuario = Usuario(
        nome=data.nome,
        email=data.email,
        senha_hash=get_password_hash(data.senha),
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)

    access_token = create_access_token(str(usuario.id))
    refresh_token = create_refresh_token(str(usuario.id))
    _issue_session_cookies(response, refresh_token)
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, response: Response, db: DBSession):
    result = await db.execute(select(Usuario).where(Usuario.email == data.email))
    usuario = result.scalar_one_or_none()

    # Mensagem genérica para não revelar se email existe
    if not usuario or not verify_password(data.senha, usuario.senha_hash):
        await rastro_client.send_warning_event(
            message="Tentativa de login com credenciais inválidas.",
            fingerprint="equili:auth:login:invalid_credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos.",
        )

    if not usuario.ativo:
        await rastro_client.send_warning_event(
            message="Tentativa de login em conta desativada.",
            fingerprint="equili:auth:login:inactive_account",
        )
        raise HTTPException(status_code=403, detail="Conta desativada.")

    access_token = create_access_token(str(usuario.id))
    refresh_token = create_refresh_token(str(usuario.id))
    _issue_session_cookies(response, refresh_token)
    return TokenResponse(access_token=access_token)


# ─── Social Auth ──────────────────────────────────────────────────────────────

class SocialGoogleRequest(BaseModel):
    id_token: str = Field(min_length=20, max_length=4096)

class SocialAppleRequest(BaseModel):
    identity_token: str = Field(min_length=20, max_length=4096)
    full_name: str | None = Field(default=None, max_length=120)


@router.post("/google", response_model=TokenResponse)
async def login_google(data: SocialGoogleRequest, response: Response, db: DBSession):
    """Valida um id_token do Google e faz login/cadastro automático."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": data.id_token},
            )
    except Exception as exc:
        logger.warning("[auth/google] falha ao validar token no Google: %s", exc)
        await rastro_client.send_warning_event(
            message="Falha de conectividade ao validar token Google.",
            fingerprint="equili:auth:google:tokeninfo_unavailable",
        )
        raise HTTPException(status_code=503, detail="Não foi possível validar o token Google agora.")

    if r.status_code != 200:
        await rastro_client.send_warning_event(
            message="Token Google inválido recebido no login social.",
            fingerprint="equili:auth:google:invalid_token",
        )
        raise HTTPException(status_code=401, detail="Token do Google inválido.")

    info = r.json()

    # Verificar audience se GOOGLE_CLIENT_ID estiver configurado
    if settings.GOOGLE_CLIENT_ID and info.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Token não pertence a este app.")

    google_id = info.get("sub")
    email = info.get("email")
    nome = info.get("name") or email.split("@")[0]

    if not google_id or not email:
        await rastro_client.send_warning_event(
            message="Token Google sem campos obrigatórios de identidade.",
            fingerprint="equili:auth:google:missing_identity_fields",
        )
        raise HTTPException(status_code=401, detail="Dados insuficientes no token Google.")

    # Busca por google_id ou por email
    usuario = await db.scalar(select(Usuario).where(Usuario.google_id == google_id))
    if not usuario:
        usuario = await db.scalar(select(Usuario).where(Usuario.email == email))
        if usuario:
            usuario.google_id = google_id
        else:
            usuario = Usuario(
                nome=nome,
                email=email,
                senha_hash=get_password_hash(os.urandom(32).hex()),
                google_id=google_id,
            )
            db.add(usuario)

    await db.commit()
    await db.refresh(usuario)

    access_token = create_access_token(str(usuario.id))
    refresh_token = create_refresh_token(str(usuario.id))
    _issue_session_cookies(response, refresh_token)
    return TokenResponse(access_token=access_token)


@router.post("/apple", response_model=TokenResponse)
async def login_apple(data: SocialAppleRequest, response: Response, db: DBSession):
    """Valida um identity_token da Apple via JWKS público e faz login/cadastro automático."""
    import base64
    import json as _json

    # 1. Busca as chaves públicas da Apple
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            jwks_resp = await client.get("https://appleid.apple.com/auth/keys")
            jwks_resp.raise_for_status()
        jwks = jwks_resp.json()
    except Exception as exc:
        logger.warning("[auth/apple] falha ao obter JWKS da Apple: %s", exc)
        await rastro_client.send_warning_event(
            message="Falha ao obter JWKS da Apple para login social.",
            fingerprint="equili:auth:apple:jwks_unavailable",
        )
        raise HTTPException(status_code=503, detail="Não foi possível verificar o token Apple.")

    # 2. Decodifica o header do JWT para obter o kid
    try:
        parts = data.identity_token.split(".")
        if len(parts) != 3:
            raise ValueError
        # Adiciona padding para base64
        header_bytes = parts[0] + "=" * (-len(parts[0]) % 4)
        header = _json.loads(base64.urlsafe_b64decode(header_bytes))
        kid = header.get("kid")
    except Exception:
        await rastro_client.send_warning_event(
            message="Token Apple malformado recebido no login social.",
            fingerprint="equili:auth:apple:malformed_token",
        )
        raise HTTPException(status_code=401, detail="Token da Apple inválido.")

    # 3. Localiza a chave correta no JWKS
    public_key = None
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            public_key = key_data
            break
    if not public_key:
        await rastro_client.send_warning_event(
            message="Chave pública Apple correspondente ao token não encontrada.",
            fingerprint="equili:auth:apple:key_not_found",
        )
        raise HTTPException(status_code=401, detail="Chave pública Apple não encontrada.")

    # 4. Verifica a assinatura do JWT usando python-jose
    from jose import jwt as jose_jwt, JWTError
    from jose.backends import RSAKey
    try:
        payload = jose_jwt.decode(
            data.identity_token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        await rastro_client.send_warning_event(
            message="Assinatura inválida no token Apple.",
            fingerprint="equili:auth:apple:invalid_signature",
        )
        raise HTTPException(status_code=401, detail="Assinatura do token Apple inválida.")

    # 5. Valida audience explicitamente contra lista permitida (app/web)
    allowed = {a.strip() for a in settings.APPLE_ALLOWED_AUDIENCES.split(",") if a.strip()}
    aud_claim = payload.get("aud")
    if isinstance(aud_claim, str):
        aud_values = {aud_claim}
    elif isinstance(aud_claim, list):
        aud_values = {str(v) for v in aud_claim}
    else:
        aud_values = set()

    if not aud_values or not (aud_values & allowed):
        await rastro_client.send_warning_event(
            message="Audience inválida no token Apple.",
            fingerprint="equili:auth:apple:invalid_audience",
        )
        raise HTTPException(status_code=401, detail="Token Apple com audience inválida.")

    apple_id = payload.get("sub")
    email = payload.get("email")
    nome = data.full_name or (email.split("@")[0] if email else "Usuário")

    if not apple_id:
        await rastro_client.send_warning_event(
            message="Token Apple sem subject (sub).",
            fingerprint="equili:auth:apple:missing_subject",
        )
        raise HTTPException(status_code=401, detail="Dados insuficientes no token Apple.")

    usuario = await db.scalar(select(Usuario).where(Usuario.apple_id == apple_id))
    if not usuario and email:
        usuario = await db.scalar(select(Usuario).where(Usuario.email == email))
        if usuario:
            usuario.apple_id = apple_id
    if not usuario:
        usuario = Usuario(
            nome=nome,
            email=email or f"{apple_id}@privaterelay.appleid.com",
            senha_hash=get_password_hash(os.urandom(32).hex()),
            apple_id=apple_id,
        )
        db.add(usuario)

    await db.commit()
    await db.refresh(usuario)

    access_token = create_access_token(str(usuario.id))
    refresh_token = create_refresh_token(str(usuario.id))
    _issue_session_cookies(response, refresh_token)
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    db: DBSession,
    origin: str | None = Header(default=None),
    csrf_header: str | None = Header(default=None, alias=CSRF_HEADER),
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
    csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE),
):
    _validate_csrf(origin, csrf_cookie, csrf_header)

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token não encontrado.")
    payload = decode_token(refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token inválido.")

    usuario_id = payload.get("sub")
    usuario = await db.get(Usuario, usuario_id)

    if not usuario or not usuario.ativo:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")

    access_token = create_access_token(str(usuario.id))
    new_refresh = create_refresh_token(str(usuario.id))
    _issue_session_cookies(response, new_refresh)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    origin: str | None = Header(default=None),
    csrf_header: str | None = Header(default=None, alias=CSRF_HEADER),
    csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE),
):
    _validate_csrf(origin, csrf_cookie, csrf_header)
    response.delete_cookie(REFRESH_COOKIE)
    response.delete_cookie(CSRF_COOKIE)
