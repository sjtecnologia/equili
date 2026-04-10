import logging
import subprocess
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.tasks.alertas import start_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
            logger.error(f"[migrations] Falha: {result.stderr}")
    except Exception as exc:
        logger.error(f"[migrations] Erro ao rodar migrations: {exc}")


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
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — permitir apenas o frontend configurado
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
