import logging
import subprocess
import sys
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.tasks.alertas import start_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Rate limiter simples em memória ─────────────────────────────────────────
# Estrutura: { ip: [(timestamp, endpoint_group), ...] }
_rate_cache: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_AUTH = 10        # 10 tentativas por janela em /auth/
_RATE_LIMIT_WINDOW = 60      # janela de 60 segundos


def _check_rate_limit(ip: str, limit: int = _RATE_LIMIT_AUTH, window: int = _RATE_LIMIT_WINDOW) -> bool:
    """Retorna True se o IP estiver dentro do limite, False se excedeu."""
    now = time.time()
    timestamps = _rate_cache[ip]
    # Remove entradas antigas
    _rate_cache[ip] = [t for t in timestamps if now - t < window]
    if len(_rate_cache[ip]) >= limit:
        return False
    _rate_cache[ip].append(now)
    return True


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
    scheduler = start_scheduler()
    yield
    # Shutdown
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
        if not _check_rate_limit(ip):
            return Response(
                content='{"detail":"Muitas tentativas. Aguarde 1 minuto."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )
    return await call_next(request)


app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
