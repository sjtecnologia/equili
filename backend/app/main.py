import logging
import subprocess
import sys
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis

from app.api.v1.router import api_router
from app.core.config import settings
from app.tasks.alertas import start_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Rate limiter simples em memória ─────────────────────────────────────────
# Estrutura: { chave: [timestamps] }
_rate_cache_auth: dict[str, list[float]] = defaultdict(list)
_rate_cache_ai: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_AUTH = 10        # 10 tentativas por janela em /auth/
_RATE_LIMIT_AUTH_WINDOW = 60  # janela de 60 segundos
_redis_client: Optional[Redis] = None


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
    global _redis_client
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
    except Exception as exc:
        _redis_client = None
        logger.warning("[rate-limit] Falha ao conectar no Redis (%s); fallback para memória", exc)


def _run_migrations() -> None:
    """Executa 'alembic upgrade head' no startup para garantir que o schema está atualizado."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            logger.info("[migrations] alembic upgrade head — OK")
        else:
            logger.error("[migrations] Falha: %s", result.stderr)
    except Exception as exc:
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

# CORS — permitir apenas o frontend configurado
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


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
        "connect-src 'self' https://models.inference.ai.azure.com; "
        "frame-ancestors 'none'"
    )
    return response


@app.middleware("http")
async def rate_limit_auth(request: Request, call_next) -> Response:
    """Rate limiting para endpoints de autenticação."""
    if request.url.path.startswith("/api/v1/auth/"):
        ip = request.client.host if request.client else "unknown"
        if not _check_rate_limit(
            key=ip,
            cache=_rate_cache_auth,
            limit=_RATE_LIMIT_AUTH,
            window=_RATE_LIMIT_AUTH_WINDOW,
        ):
            return Response(
                content='{"detail":"Muitas tentativas. Aguarde 1 minuto."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )
    return await call_next(request)


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
