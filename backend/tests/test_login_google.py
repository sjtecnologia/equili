import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.core import dependencies as dependencies_module
from app.core.config import settings
from app.models.usuario import Usuario

IOS_CLIENT_ID = "168293330988-jfn3jmhccim4d2f6nkl0bmq8s2cu7fth.apps.googleusercontent.com"
WEB_CLIENT_ID = "168293330988-8vrl33e09v42rrq1efo44i8a36t4e3eq.apps.googleusercontent.com"

GOOGLE_SUB = "google-sub-123"
GOOGLE_EMAIL = "maria@example.com"


@pytest.fixture()
def google_client():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def setup_db() -> None:
        async with engine.begin() as conn:
            await conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS usuarios (
                    id TEXT PRIMARY KEY,
                    nome TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    senha_hash TEXT NOT NULL,
                    google_id TEXT,
                    apple_id TEXT,
                    telefone TEXT,
                    plano TEXT NOT NULL DEFAULT 'gratuito',
                    is_admin INTEGER NOT NULL DEFAULT 0,
                    email_verificado INTEGER NOT NULL DEFAULT 0,
                    ativo INTEGER NOT NULL DEFAULT 1,
                    criado_em TEXT,
                    atualizado_em TEXT
                )
                """
            )
            await conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS sessoes (
                    id TEXT PRIMARY KEY,
                    usuario_id TEXT NOT NULL,
                    jti TEXT NOT NULL UNIQUE,
                    criado_em TEXT NOT NULL,
                    expira_em TEXT NOT NULL,
                    revogada_em TEXT,
                    user_agent TEXT,
                    ip TEXT,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
                )
                """
            )
        # Usuário já existente: o login por google_id evita o cadastro
        # automático (e, com ele, a criação das categorias padrão).
        async with session_factory() as session:
            session.add(
                Usuario(
                    nome="Maria",
                    email=GOOGLE_EMAIL,
                    senha_hash="hash",
                    google_id=GOOGLE_SUB,
                )
            )
            await session.commit()

    asyncio.run(setup_db())

    async def override_get_session():
        async with session_factory() as session:
            yield session

    main_module.app.dependency_overrides[dependencies_module.get_session] = override_get_session

    with TestClient(main_module.app) as client:
        yield client

    main_module.app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def _fake_tokeninfo(monkeypatch, payload: dict, status_code: int = 200) -> None:
    class FakeResponse:
        def __init__(self) -> None:
            self.status_code = status_code

        def json(self) -> dict:
            return payload

    async def fake_get(self, *args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)


def _token_payload(**overrides) -> dict:
    payload = {
        "sub": GOOGLE_SUB,
        "email": GOOGLE_EMAIL,
        "name": "Maria",
        "aud": WEB_CLIENT_ID,
        "azp": IOS_CLIENT_ID,
    }
    payload.update(overrides)
    return payload


def test_login_google_aceita_aud_web_com_azp_ios(google_client, monkeypatch):
    """App mobile: id_token com aud = client ID WEB e azp = client ID iOS."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", IOS_CLIENT_ID)
    _fake_tokeninfo(monkeypatch, _token_payload())

    response = google_client.post(
        "/api/v1/auth/google",
        json={"id_token": "a" * 40},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_google_aceita_aud_ios_direto(google_client, monkeypatch):
    """Sem serverClientID, o aud já é o client ID iOS configurado."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", IOS_CLIENT_ID)
    _fake_tokeninfo(monkeypatch, _token_payload(aud=IOS_CLIENT_ID, azp=None))

    response = google_client.post(
        "/api/v1/auth/google",
        json={"id_token": "a" * 40},
    )

    assert response.status_code == 200


def test_login_google_rejeita_token_de_outro_app(google_client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", IOS_CLIENT_ID)
    _fake_tokeninfo(
        monkeypatch,
        _token_payload(aud="999999999-xxx.apps.googleusercontent.com", azp="999999999-yyy.apps.googleusercontent.com"),
    )

    response = google_client.post(
        "/api/v1/auth/google",
        json={"id_token": "a" * 40},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Token não pertence a este app."
