import logging
import os
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
import jwt
from fastapi import APIRouter, Cookie, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.config import settings
from app.core.dependencies import CurrentUserID, DBSession
from app.core.rastro_client import rastro_client
from app.core.security import (
    build_email_verification_link,
    create_access_token,
    create_email_verification_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    get_refresh_jti,
    verify_password,
)
from app.models.sessao import Sessao
from app.models.usuario import Usuario
from app.schemas.auth import (
    EmailResendRequest,
    EmailVerificationRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)

REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"
_EMAIL_VERIFY_RATE_LIMIT_SECONDS = 60
_EMAIL_VERIFY_RATE_LIMIT_CACHE: dict[str, list[float]] = defaultdict(list)

def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=not settings.DEBUG,
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


def _request_metadata(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("user-agent")
    ip = request.client.host if request.client else None
    return (
        user_agent[:512] if user_agent else None,
        ip[:64] if ip else None,
    )


def _is_session_valid_for_refresh(sessao: Sessao | None, usuario_id: UUID, now: datetime) -> bool:
    if sessao is None:
        return False
    if sessao.usuario_id != usuario_id:
        return False
    if sessao.revogada_em is not None:
        return False
    return not sessao.expira_em <= now


async def _register_refresh_session(
    db: DBSession,
    user_id: UUID | str,
    refresh_token: str,
    request: Request,
) -> Sessao:
    payload = decode_token(refresh_token)
    jti = payload.get("jti") if payload else None
    if not payload or payload.get("type") != "refresh" or not jti:
        raise HTTPException(status_code=401, detail="Refresh token inválido. Faça login novamente.")

    try:
        jti_uuid = UUID(str(jti))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Refresh token inválido. Faça login novamente.") from exc

    user_agent, ip = _request_metadata(request)
    agora = datetime.now(timezone.utc)
    sessao = Sessao(
        usuario_id=UUID(str(user_id)),
        jti=jti_uuid,
        criado_em=agora,
        expira_em=agora + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip=ip,
    )
    db.add(sessao)
    await db.commit()
    await db.refresh(sessao)
    return sessao


async def _revoke_user_sessions(db: DBSession, user_id: UUID | str) -> None:
    user_uuid = UUID(str(user_id))
    result = await db.execute(
        select(Sessao).where(Sessao.usuario_id == user_uuid, Sessao.revogada_em.is_(None))
    )
    sessoes = result.scalars().all()
    if not sessoes:
        return
    agora = datetime.now(timezone.utc)
    for sessao in sessoes:
        sessao.revogada_em = agora
    await db.commit()


async def _revoke_session_by_jti(db: DBSession, jti: str | UUID | None) -> None:
    if jti is None:
        return
    try:
        token_jti = UUID(str(jti))
    except ValueError:
        return
    sessao = await db.scalar(select(Sessao).where(Sessao.jti == token_jti))
    if sessao is None:
        return
    sessao.revogada_em = datetime.now(timezone.utc)
    await db.commit()


async def _issue_refresh_and_session(
    db: DBSession,
    response: Response,
    request: Request,
    user_id: UUID | str,
) -> str:
    refresh_token = create_refresh_token(str(user_id))
    await _register_refresh_session(db, user_id, refresh_token, request)
    _issue_session_cookies(response, refresh_token)
    return refresh_token


def _send_verification_email(email: str, token: str) -> dict:
    url = build_email_verification_link(token)
    payload = {
        "from": settings.EMAIL_FROM,
        "to": [email],
        "subject": "Confirme seu e-mail",
        "html": (
            "<p>Para confirmar seu e-mail, clique no link abaixo:</p>"
            f"<p><a href=\"{url}\">Confirmar e-mail</a></p>"
            "<p>Se você não solicitou esse cadastro, pode ignorar este e-mail.</p>"
        ),
    }

    if not settings.RESEND_API_KEY:
        logger.info("[auth/email] API key do Resend ausente; envio de verificação ignorado para %s", email)
        return {"id": "dev-skip"}

    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        return resend.Emails.send(payload)
    except Exception as exc:  # pragma: no cover - depende de serviço externo  # noqa: BLE001
        logger.warning("[auth/email] falha ao enviar e-mail de verificação para %s: %s", email, exc)
        return {"id": "send-failed"}


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
async def register(data: RegisterRequest, response: Response, db: DBSession, request: Request):
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

    verification_token = create_email_verification_token(str(usuario.id), usuario.email)
    _send_verification_email(usuario.email, verification_token)

    access_token = create_access_token(str(usuario.id))
    await _issue_refresh_and_session(db, response, request, usuario.id)
    return TokenResponse(
        access_token=access_token,
        email_verificado=usuario.email_verificado,
        verification_required=not usuario.email_verificado,
    )


@router.post("/verificar-email")
async def verificar_email(data: EmailVerificationRequest, db: DBSession):
    payload = decode_token(data.token)
    if not payload or payload.get("type") != "email_verify":
        raise HTTPException(status_code=401, detail="Token de verificação inválido ou expirado.")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Token de verificação sem e-mail válido.")

    usuario = await db.scalar(select(Usuario).where(Usuario.email == email))
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    usuario.email_verificado = True
    await db.commit()
    return {"message": "E-mail verificado com sucesso.", "email_verificado": True}


@router.post("/reenviar-verificacao")
async def reenviar_verificacao(data: EmailResendRequest, db: DBSession):
    email = data.email.lower().strip()
    now = time.time()
    window = _EMAIL_VERIFY_RATE_LIMIT_CACHE[email]
    window[:] = [ts for ts in window if now - ts < _EMAIL_VERIFY_RATE_LIMIT_SECONDS]

    if window:
        raise HTTPException(
            status_code=429,
            detail=f"Aguarde {_EMAIL_VERIFY_RATE_LIMIT_SECONDS} segundos antes de reenviar a verificação.",
        )

    window.append(now)

    usuario = await db.scalar(select(Usuario).where(Usuario.email == email))
    if usuario and not usuario.email_verificado:
        token = create_email_verification_token(str(usuario.id), usuario.email)
        _send_verification_email(usuario.email, token)

    return {
        "message": "Se o endereço estiver cadastrado e ainda não estiver verificado, um novo e-mail foi enviado.",
    }


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, response: Response, db: DBSession, request: Request):
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
    await _issue_refresh_and_session(db, response, request, usuario.id)
    return TokenResponse(
        access_token=access_token,
        email_verificado=usuario.email_verificado,
        verification_required=not usuario.email_verificado,
    )


# ─── Social Auth ──────────────────────────────────────────────────────────────

class SocialGoogleRequest(BaseModel):
    id_token: str = Field(min_length=20, max_length=4096)

class SocialAppleRequest(BaseModel):
    identity_token: str = Field(min_length=20, max_length=4096)
    full_name: str | None = Field(default=None, max_length=120)


@router.post("/google", response_model=TokenResponse)
async def login_google(data: SocialGoogleRequest, response: Response, db: DBSession, request: Request):
    """Valida um id_token do Google e faz login/cadastro automático."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": data.id_token},
            )
    except (httpx.HTTPError, ValueError) as exc:
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

    usuario.email_verificado = True
    await db.commit()
    await db.refresh(usuario)

    access_token = create_access_token(str(usuario.id))
    await _issue_refresh_and_session(db, response, request, usuario.id)
    return TokenResponse(
        access_token=access_token,
        email_verificado=usuario.email_verificado,
        verification_required=False,
    )


@router.post("/apple", response_model=TokenResponse)
async def login_apple(data: SocialAppleRequest, response: Response, db: DBSession, request: Request):
    """Valida um identity_token da Apple via JWKS público e faz login/cadastro automático."""
    import base64
    import json as _json

    # 1. Busca as chaves públicas da Apple
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            jwks_resp = await client.get("https://appleid.apple.com/auth/keys")
            jwks_resp.raise_for_status()
        jwks = jwks_resp.json()
    except (httpx.HTTPError, ValueError) as exc:
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
    except (TypeError, ValueError, _json.JSONDecodeError):
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

    # 4. Verifica a assinatura do JWT usando PyJWT
    try:
        payload = jwt.decode(
            data.identity_token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
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

    usuario.email_verificado = True
    await db.commit()
    await db.refresh(usuario)

    access_token = create_access_token(str(usuario.id))
    await _issue_refresh_and_session(db, response, request, usuario.id)
    return TokenResponse(
        access_token=access_token,
        email_verificado=usuario.email_verificado,
        verification_required=False,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    request: Request,
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
        raise HTTPException(status_code=401, detail="Refresh token inválido. Faça login novamente.")

    jti = get_refresh_jti(refresh_token)
    if not jti:
        raise HTTPException(status_code=401, detail="Refresh token sem sessão válida. Faça login novamente.")

    usuario_id = payload.get("sub")
    try:
        usuario_uuid = UUID(str(usuario_id))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Refresh token inválido. Faça login novamente.")

    usuario = await db.get(Usuario, usuario_uuid)
    if not usuario or not usuario.ativo:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")

    sessao = await db.scalar(select(Sessao).where(Sessao.jti == UUID(jti)))
    agora = datetime.now(timezone.utc)
    if not _is_session_valid_for_refresh(sessao, usuario_uuid, agora):
        await _revoke_user_sessions(db, usuario_uuid)
        raise HTTPException(status_code=401, detail="Sessão inválida ou revogada. Faça login novamente.")

    sessao.revogada_em = agora
    await db.commit()

    access_token = create_access_token(str(usuario.id))
    await _issue_refresh_and_session(db, response, request, usuario.id)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: DBSession,
    request: Request,
    origin: str | None = Header(default=None),
    csrf_header: str | None = Header(default=None, alias=CSRF_HEADER),
    csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE),
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
):
    _validate_csrf(origin, csrf_cookie, csrf_header)
    if refresh_token:
        jti = get_refresh_jti(refresh_token)
        if jti:
            await _revoke_session_by_jti(db, jti)
    response.delete_cookie(REFRESH_COOKIE)
    response.delete_cookie(CSRF_COOKIE)


@router.get("/sessoes")
async def list_sessoes(current_user_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(Sessao).where(
            Sessao.usuario_id == current_user_id,
            Sessao.revogada_em.is_(None),
        ).order_by(Sessao.criado_em.desc())
    )
    sessoes = result.scalars().all()
    return [
        {
            "id": str(sessao.id),
            "jti": str(sessao.jti),
            "criado_em": sessao.criado_em.isoformat(),
            "expira_em": sessao.expira_em.isoformat(),
            "user_agent": sessao.user_agent,
            "ip": sessao.ip,
        }
        for sessao in sessoes
    ]


@router.delete("/sessoes/{sessao_id}")
async def revoke_sessao_by_id(
    sessao_id: UUID,
    db: DBSession,
    current_user_id: CurrentUserID,
):
    sessao = await db.get(Sessao, sessao_id)
    if not sessao or sessao.usuario_id != current_user_id:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    sessao.revogada_em = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "revogada"}


@router.delete("/sessoes")
async def revoke_all_sessoes(
    response: Response,
    db: DBSession,
    current_user_id: CurrentUserID,
):
    await _revoke_user_sessions(db, current_user_id)
    response.delete_cookie(REFRESH_COOKIE)
    response.delete_cookie(CSRF_COOKIE)
    return {"status": "todas_revogadas"}
