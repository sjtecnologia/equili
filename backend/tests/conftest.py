import asyncio
import os
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import ext as sa_ext
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

_real_create_async_engine = sa_ext.asyncio.create_async_engine


def _sqlite_compatible_create_async_engine(url, *args, **kwargs):
    if str(url).startswith("sqlite"):
        kwargs.pop("pool_size", None)
        kwargs.pop("max_overflow", None)
        kwargs.pop("pool_pre_ping", None)
    return _real_create_async_engine(url, *args, **kwargs)


sa_ext.asyncio.create_async_engine = _sqlite_compatible_create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app import main as main_module
from app.core import dependencies as dependencies_module
from app.models.usuario import Usuario


class _DummyScheduler:
    def shutdown(self, wait: bool = False):
        return None


async def _create_sqlite_schema(conn) -> None:
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
        CREATE TABLE IF NOT EXISTS rendas (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            frequencia TEXT NOT NULL,
            tipo TEXT NOT NULL,
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS contas_a_pagar (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            conta_fixa_id TEXT,
            divida_id TEXT,
            descricao TEXT NOT NULL,
            categoria TEXT NOT NULL,
            valor REAL NOT NULL,
            data_vencimento TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente',
            tipo TEXT NOT NULL DEFAULT 'avulsa',
            pago_em TEXT,
            observacao TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS contas_a_receber (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            renda_id TEXT,
            descricao TEXT NOT NULL,
            origem TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'avulsa',
            valor REAL NOT NULL,
            data_prevista TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente',
            devedor TEXT,
            recebido_em TEXT,
            observacao TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS dividas (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            descricao TEXT NOT NULL,
            credor TEXT,
            tipo TEXT NOT NULL,
            valor_total REAL NOT NULL,
            valor_parcela REAL NOT NULL,
            parcelas_totais INTEGER,
            parcelas_restantes INTEGER NOT NULL,
            taxa_juros_mensal REAL,
            data_inicio_contrato TEXT,
            data_primeira_parcela TEXT,
            data_prox_vencimento TEXT NOT NULL,
            quitada INTEGER NOT NULL DEFAULT 0,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS divida_pagamentos (
            id TEXT PRIMARY KEY,
            divida_id TEXT NOT NULL,
            usuario_id TEXT NOT NULL,
            data_referencia TEXT NOT NULL,
            data_pagamento TEXT NOT NULL,
            valor_pago REAL NOT NULL,
            valor_parcela_original REAL NOT NULL,
            observacao TEXT,
            criado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS contas_bancarias (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            nome TEXT NOT NULL,
            banco TEXT NOT NULL,
            tipo TEXT NOT NULL,
            saldo_inicial REAL NOT NULL DEFAULT 0,
            cor TEXT NOT NULL DEFAULT '#2E7D5E',
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS cartoes_credito (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            nome TEXT NOT NULL,
            bandeira TEXT NOT NULL,
            limite REAL NOT NULL,
            limite_atual REAL NOT NULL DEFAULT 0,
            dia_fechamento INTEGER NOT NULL,
            dia_vencimento INTEGER NOT NULL,
            cor TEXT NOT NULL DEFAULT '#1A3C5E',
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS lancamentos_conta (
            id TEXT PRIMARY KEY,
            conta_bancaria_id TEXT NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            tipo TEXT NOT NULL,
            data TEXT NOT NULL,
            categoria TEXT,
            origem TEXT NOT NULL DEFAULT 'manual',
            ofx_id TEXT,
            criado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS lancamentos_cartao (
            id TEXT PRIMARY KEY,
            cartao_credito_id TEXT NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            tipo TEXT NOT NULL,
            data TEXT NOT NULL,
            categoria TEXT,
            criado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS planos_acao (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            conteudo TEXT NOT NULL,
            conteudo_texto TEXT NOT NULL,
            estrategia TEXT,
            data_livre_prevista TEXT,
            feedback INTEGER,
            feedback_texto TEXT,
            tokens_usados INTEGER,
            criado_em TEXT
        )
        """
    )


@pytest.fixture()
def finance_client():
    main_module._run_migrations = lambda: None
    main_module.start_scheduler = lambda: _DummyScheduler()

    user_id = uuid4()
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def setup_db() -> None:
        async with engine.begin() as conn:
            await _create_sqlite_schema(conn)
        async with session_factory() as session:
            session.add(
                Usuario(
                    id=user_id,
                    nome="Usuário Financeiro",
                    email=f"finance-{user_id}@example.com",
                    senha_hash="hashed-password",
                    plano="gratuito",
                    email_verificado=True,
                    ativo=True,
                )
            )
            await session.commit()

    asyncio.run(setup_db())

    async def override_get_session():
        async with session_factory() as session:
            yield session

    async def override_get_current_user_id():
        return user_id

    main_module.app.dependency_overrides[dependencies_module.get_session] = override_get_session
    main_module.app.dependency_overrides[dependencies_module.get_current_user_id] = override_get_current_user_id

    with TestClient(main_module.app) as client:
        yield client, user_id, session_factory

    main_module.app.dependency_overrides.clear()
    asyncio.run(engine.dispose())
