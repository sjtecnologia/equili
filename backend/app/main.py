import logging
import subprocess
import sys
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.rastro_client import rastro_client
from app.tasks.alertas import start_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Rate limiter simples em memória ─────────────────────────────────────────
# Estrutura: { chave: [timestamps] }
_rate_cache_auth: dict[str, list[float]] = defaultdict(list)
_rate_cache_ai: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_AUTH = 10        # 10 tentativas por janela em /auth/login e /auth/register
_RATE_LIMIT_AUTH_WINDOW = 900 # 15 minutos para mitigar brute force
_redis_client: Redis | None = None


def _check_rate_limit(
    key: str,
    cache: dict[str, list[float]],
    limit: int,
    window: int,
) -> bool:
    """Retorna True se o IP estiver dentro do limite, False se excedeu."""
    now = time.time()
    timestamps = cache[key]
    # Remove entradas antigas
    cache[key] = [t for t in timestamps if now - t < window]
    if len(cache[key]) >= limit:
        return False
    cache[key].append(now)
    return True


async def _check_rate_limit_redis(
    key: str,
    limit: int,
    window: int,
) -> bool:
    """Retorna True se estiver dentro do limite no Redis (janela fixa)."""
    if not _redis_client:
        return True

    bucket = int(time.time()) // window
    redis_key = f"rl:{key}:{bucket}"

    current = await _redis_client.incr(redis_key)
    if current == 1:
        # Expira após a janela para evitar crescimento de chaves.
        await _redis_client.expire(redis_key, window + 1)
    return current <= limit


async def _init_redis() -> None:
    """Inicializa cliente Redis opcional para rate limit distribuído."""
    global _redis_client
    if not settings.REDIS_URL:
        logger.info("[rate-limit] Redis desabilitado; usando cache em memória")
        return

    try:
        client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        await client.ping()
        _redis_client = client
        logger.info("[rate-limit] Redis conectado para rate limiting distribuído")
    except (ConnectionError, OSError, TimeoutError, ValueError) as exc:
        _redis_client = None
        logger.warning("[rate-limit] Falha ao conectar no Redis (%s); fallback para memória", exc)
        await rastro_client.send_warning_event(
            message=f"Redis indisponível para rate limiting distribuído: {exc}",
            fingerprint="equili:infra:redis:rate_limit_fallback_memory",
        )


def _run_migrations() -> None:
    """Executa 'alembic upgrade head' no startup para garantir que o schema está atualizado."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        if result.returncode == 0:
            logger.info("[migrations] alembic upgrade head — OK")
        else:
            logger.error("[migrations] Falha: %s", result.stderr)
    except (OSError, RuntimeError, TimeoutError) as exc:
        logger.error("[migrations] Erro ao rodar migrations: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    _run_migrations()
    await _init_redis()
    scheduler = start_scheduler()
    yield
    # Shutdown
    if _redis_client:
        await _redis_client.aclose()
    scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

# CORS — permitir apenas origins explícitas do frontend e do ambiente de produção.
origins = [origin for origin in list(dict.fromkeys([*settings.ALLOWED_ORIGINS, settings.FRONTEND_URL])) if origin and origin != "*"]
if settings.DEBUG:
    origins.extend(["http://localhost:5173", "http://127.0.0.1:5173"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(origins)),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-CSRF-Token"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next) -> Response:
    """Gera request_id por requisição e propaga no header de resposta."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    request.state.request_started = time.perf_counter()

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    """Adiciona headers de segurança HTTP em todas as respostas."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "base-uri 'self'; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "connect-src 'self' https://models.inference.ai.azure.com https://api.resend.com"
    )
    return response


@app.middleware("http")
async def rate_limit_auth(request: Request, call_next) -> Response:
    """Rate limiting para endpoints sensíveis de autenticação."""
    restricted_paths = {"/api/v1/auth/login", "/api/v1/auth/register"}
    if request.url.path in restricted_paths:
        ip = request.client.host if request.client else "unknown"
        if not _check_rate_limit(
            key=f"auth:{ip}:{request.url.path}",
            cache=_rate_cache_auth,
            limit=_RATE_LIMIT_AUTH,
            window=_RATE_LIMIT_AUTH_WINDOW,
        ):
            await rastro_client.send_warning_event(
                message=f"Rate limit de autenticação excedido para IP {ip} em {request.url.path}",
                fingerprint="equili:security:rate_limit:auth_exceeded",
            )
            return Response(
                content='{"detail":"Muitas tentativas. Aguarde 15 minutos e tente novamente."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(_RATE_LIMIT_AUTH_WINDOW)},
            )
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Captura exceções não tratadas e envia para o Rastro."""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    path = request.url.path
    method = request.method
    error_type = exc.__class__.__name__

    await rastro_client.send_error_event(
        message=f"{error_type} em {method} {path}: {exc!s}",
        fingerprint=f"equili:{error_type}:{method}:{path}",
        level="error",
        trace_id=request_id,
    )

    logger.exception("[api] erro nao tratado request_id=%s path=%s", request_id, path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor", "requestId": request_id},
    )


@app.middleware("http")
async def rate_limit_ai(request: Request, call_next) -> Response:
    """Rate limiting para endpoints de IA (chat/voz)."""
    ai_paths = (
        "/api/v1/chat",
        "/api/v1/voz/comando",
        "/api/v1/voz/interpretar-data",
    )

    if request.url.path in ai_paths:
        ip = request.client.host if request.client else "unknown"
        allowed = False
        if _redis_client:
            allowed = await _check_rate_limit_redis(
                key=f"ai:{ip}",
                limit=settings.RATE_LIMIT_AI_REQUESTS,
                window=settings.RATE_LIMIT_AI_WINDOW_SECONDS,
            )
        else:
            allowed = _check_rate_limit(
                key=f"ai:{ip}",
                cache=_rate_cache_ai,
                limit=settings.RATE_LIMIT_AI_REQUESTS,
                window=settings.RATE_LIMIT_AI_WINDOW_SECONDS,
            )

        if not allowed:
            await rastro_client.send_warning_event(
                message=f"Rate limit de IA excedido para IP {ip} em {request.url.path}",
                fingerprint="equili:security:rate_limit:ai_exceeded",
            )
            return Response(
                content='{"detail":"Muitas requisições para IA. Aguarde e tente novamente."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(settings.RATE_LIMIT_AI_WINDOW_SECONDS)},
            )
    return await call_next(request)


app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
