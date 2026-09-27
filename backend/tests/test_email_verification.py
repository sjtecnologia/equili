import asyncio
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.core import dependencies as dependencies_module
from app.core.security import create_email_verification_token
from app.models.usuario import Usuario


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

    asyncio.run(setup_db())

    async def override_get_session():
        async with session_factory() as session:
            yield session

    main_module.app.dependency_overrides[dependencies_module.get_session] = override_get_session

    with TestClient(main_module.app) as client:
        yield client, session_factory

    main_module.app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def test_register_envia_email_de_verificacao(auth_client, monkeypatch):
    client, _ = auth_client
    calls = []

    def fake_send(email: str, token: str) -> dict:
        calls.append({"email": email, "token": token})
        return {"id": "mail_123"}

    import app.api.v1.routes.auth as auth_module

    monkeypatch.setattr(auth_module, "_send_verification_email", fake_send, raising=False)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "nome": "Maria",
            "email": "maria@example.com",
            "senha": "Senha123",
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["access_token"]
    assert payload["email_verificado"] is False
    assert len(calls) == 1
    assert calls[0]["email"] == "maria@example.com"
    assert calls[0]["token"].startswith("eyJ")


def test_verificar_email_token_valido(auth_client):
    client, session_factory = auth_client
    email = "valido@example.com"

    async def seed_user():
        async with session_factory() as session:
            user = Usuario(
                nome="Valido",
                email=email,
                senha_hash="hashed-password",
                email_verificado=False,
                ativo=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return str(user.id)

    asyncio.run(seed_user())
    token = create_email_verification_token("user-1", email)

    response = client.post(
        "/api/v1/auth/verificar-email",
        json={"token": token},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["email_verificado"] is True

    async def assert_verified():
        async with session_factory() as session:
            user = await session.scalar(select(Usuario).where(Usuario.email == email))
            return user.email_verificado

    assert asyncio.run(assert_verified()) is True


def test_verificar_email_token_expirado(auth_client):
    client, _ = auth_client
    email = "expirado@example.com"
    token = create_email_verification_token("user-123", email, expires_delta=timedelta(minutes=-5))

    response = client.post(
        "/api/v1/auth/verificar-email",
        json={"token": token},
    )

    assert response.status_code == 401, response.text


def test_reenvio_verificacao_respeita_rate_limit(auth_client, monkeypatch):
    client, _ = auth_client
    sent = []

    def fake_send(email: str, token: str) -> dict:
        sent.append((email, token))
        return {"id": "mail_retry"}

    import app.api.v1.routes.auth as auth_module

    monkeypatch.setattr(auth_module, "_send_verification_email", fake_send, raising=False)

    # create a real user and then request two resends quickly
    client.post(
        "/api/v1/auth/register",
        json={
            "nome": "Reenvio",
            "email": "reenviar@example.com",
            "senha": "Senha123",
        },
    )

    first = client.post(
        "/api/v1/auth/reenviar-verificacao",
        json={"email": "reenviar@example.com"},
    )
    second = client.post(
        "/api/v1/auth/reenviar-verificacao",
        json={"email": "reenviar@example.com"},
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 429, second.text
    assert len(sent) >= 2
