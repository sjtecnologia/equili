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
            valor_baixado REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pendente',
            tipo TEXT NOT NULL DEFAULT 'avulsa',
            pago_em TEXT,
            conta_id TEXT,
            cartao_id TEXT,
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
            valor_baixado REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pendente',
            devedor TEXT,
            recebido_em TEXT,
            data_recebimento TEXT,
            meio_recebimento TEXT,
            conta_id TEXT,
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
        CREATE TABLE IF NOT EXISTS categorias (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT NOT NULL,
            cor TEXT,
            icone TEXT,
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT,
            updated_at TEXT,
            UNIQUE (usuario_id, tipo, nome)
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS investimentos (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT NOT NULL,
            instituicao TEXT,
            quantidade REAL,
            preco_medio REAL,
            valor_investido REAL NOT NULL,
            valor_atual REAL NOT NULL,
            data_aplicacao TEXT NOT NULL,
            observacao TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS tarefas (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            titulo TEXT NOT NULL,
            concluida INTEGER NOT NULL DEFAULT 0,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS itens_compra (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            nome TEXT NOT NULL,
            quantidade REAL NOT NULL DEFAULT 1,
            unidade TEXT,
            comprado INTEGER NOT NULL DEFAULT 0,
            observacao TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS nfs_recebidas (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            numero TEXT NOT NULL,
            serie TEXT,
            valor REAL NOT NULL,
            chave_acesso TEXT NOT NULL,
            codigo_verificacao TEXT,
            cpf_cnpj TEXT,
            inscricao_municipal TEXT,
            url_consulta TEXT,
            data_emissao TEXT,
            created_at TEXT
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
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS uso_ia (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            recurso TEXT NOT NULL,
            periodo TEXT NOT NULL,
            contador INTEGER NOT NULL DEFAULT 0,
            atualizado_em TEXT,
            UNIQUE (usuario_id, recurso, periodo)
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS metas (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            titulo TEXT NOT NULL,
            descricao TEXT,
            categoria TEXT,
            valor_alvo REAL NOT NULL,
            valor_atual REAL NOT NULL DEFAULT 0,
            prazo TEXT,
            concluida INTEGER NOT NULL DEFAULT 0,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS assinaturas (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            plano TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
            gateway TEXT NOT NULL DEFAULT 'mock',
            gateway_assinatura_id TEXT,
            preco_mensal REAL NOT NULL DEFAULT 0,
            data_inicio TEXT,
            data_proxima_cobranca TEXT,
            cancelada_em TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    await conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS pagamentos (
            id TEXT PRIMARY KEY,
            assinatura_id TEXT,
            usuario_id TEXT NOT NULL,
            plano TEXT NOT NULL,
            metodo TEXT NOT NULL,
            valor REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente',
            gateway TEXT NOT NULL DEFAULT 'mock',
            gateway_pagamento_id TEXT,
            qr_code TEXT,
            qr_base64 TEXT,
            url_pagamento TEXT,
            expira_em TEXT,
            criado_em TEXT,
            pago_em TEXT
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
            from app.models.conta_lancamento import BaixaConta
            await conn.run_sync(lambda sync_conn: BaixaConta.__table__.create(sync_conn))
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
