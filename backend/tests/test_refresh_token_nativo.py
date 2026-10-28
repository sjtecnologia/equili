from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.core import dependencies as dependencies_module
from app.core.security import get_password_hash
from app.models.usuario import Usuario

EMAIL = "joao@example.com"
SENHA = "SenhaForte1"

# Origem do WebView do app mobile (Capacitor).
ORIGEM_APP = {"Origin": "capacitor://localhost"}
ORIGEM_WEB = {"Origin": "https://equili.com.br"}


@pytest.fixture()
def auth_client():
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
        async with session_factory() as session:
            session.add(
                Usuario(
                    nome="João",
                    email=EMAIL,
                    senha_hash=get_password_hash(SENHA),
                    email_verificado=True,
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


def _login(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": EMAIL, "senha": SENHA},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_login_devolve_refresh_token_para_o_app(auth_client):
    """No app o cookie httpOnly não chega ao backend, então o refresh token vai no corpo."""
    corpo = _login(auth_client, ORIGEM_APP)

    assert corpo["access_token"]
    assert corpo["refresh_token"]


def test_login_web_nao_devolve_refresh_token(auth_client):
    """Na web o refresh continua sendo só o cookie httpOnly (menos exposto para XSS)."""
    corpo = _login(auth_client, ORIGEM_WEB)

    assert corpo["access_token"]
    assert corpo["refresh_token"] is None


def test_refresh_no_corpo_funciona_sem_cookie_e_sem_csrf(auth_client):
    """Cenário do app: nenhum cookie/CSRF disponível em capacitor://localhost."""
    login = _login(auth_client, ORIGEM_APP)

    refresh = auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login["refresh_token"]},
        headers=ORIGEM_APP,
    )

    assert refresh.status_code == 200, refresh.text
    corpo = refresh.json()
    assert corpo["access_token"]
    assert corpo["refresh_token"]
    # Rotação: cada uso devolve um token novo.
    assert corpo["refresh_token"] != login["refresh_token"]


def test_refresh_token_antigo_e_rejeitado_apos_rotacao(auth_client):
    login = _login(auth_client, ORIGEM_APP)
    token_antigo = login["refresh_token"]

    primeira = auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token_antigo},
        headers=ORIGEM_APP,
    )
    assert primeira.status_code == 200

    reuso = auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token_antigo},
        headers=ORIGEM_APP,
    )
    assert reuso.status_code == 401


def test_refresh_via_cookie_continua_exigindo_csrf(auth_client):
    """O caminho da web (cookie) não perdeu a proteção de CSRF."""
    response = auth_client.post(
        "/api/v1/auth/refresh",
        json={},
        headers=ORIGEM_WEB,
    )

    assert response.status_code == 403
