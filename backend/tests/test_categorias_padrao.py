from __future__ import annotations

import asyncio
import importlib.util
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy import select

from app.models.categoria import Categoria
from app.services.categorias_padrao import CATEGORIAS_PADRAO, seed_categorias_padrao

MIGRATION = Path(__file__).resolve().parents[1] / "alembic/versions/f2a3b4c5d6e7_backfill_categorias_padrao.py"


def _carregar_migration():
    spec = importlib.util.spec_from_file_location("backfill_categorias", MIGRATION)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _total_padrao() -> int:
    return sum(len(n) for n in CATEGORIAS_PADRAO.values())


def test_seed_idempotente_nao_duplica(finance_client):
    _, user_id, session_factory = finance_client

    async def run():
        async with session_factory() as s:
            await seed_categorias_padrao(s, user_id)
            await s.commit()
        async with session_factory() as s:
            await seed_categorias_padrao(s, user_id)
            await s.commit()
            return (await s.execute(select(Categoria).where(Categoria.usuario_id == user_id))).scalars().all()

    cats = asyncio.run(run())
    assert len(cats) == _total_padrao()
    assert all(c.ativo for c in cats)


def test_registro_semeia_categorias_padrao(finance_client, monkeypatch):
    client, _, session_factory = finance_client
    from app.api.v1.routes import auth

    monkeypatch.setattr(auth, "_send_verification_email", lambda *a, **k: None)

    async def sem_sessao(*a, **k):
        return None

    monkeypatch.setattr(auth, "_issue_refresh_and_session", sem_sessao)

    r = client.post(
        "/api/v1/auth/register",
        json={"nome": "Novo", "email": f"novo-{uuid4()}@example.com", "senha": "Senha1234"},
    )
    assert r.status_code == 201, r.text

    async def run():
        async with session_factory() as s:
            return (await s.execute(select(Categoria))).scalars().all()

    cats = asyncio.run(run())
    assert len(cats) == _total_padrao()


def _engine_migration():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.exec_driver_sql("CREATE TABLE usuarios (id TEXT PRIMARY KEY)")
        conn.exec_driver_sql(
            "CREATE TABLE categorias (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, nome TEXT NOT NULL, "
            "tipo TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, UNIQUE (usuario_id, tipo, nome))"
        )
        conn.exec_driver_sql(
            "CREATE TABLE contas_a_pagar (id TEXT PRIMARY KEY, usuario_id TEXT, categoria TEXT, valor REAL, status TEXT)"
        )
        conn.exec_driver_sql(
            "CREATE TABLE contas_a_receber (id TEXT PRIMARY KEY, usuario_id TEXT, origem TEXT, valor REAL, status TEXT)"
        )
    return engine


def test_migration_backfill_normaliza_e_preserva():
    mod = _carregar_migration()
    engine = _engine_migration()
    with engine.begin() as conn:
        conn.exec_driver_sql("INSERT INTO usuarios VALUES ('u1'), ('u2')")
        conn.exec_driver_sql(
            "INSERT INTO contas_a_pagar VALUES "
            "('p1','u1','Moradia',10,'pago'), ('p2','u1',' LAZER ',20,'pendente'), "
            "('p3','u1','Pets',30,'pendente'), ('p4','u2','moradia',40,'pendente'), ('p5','u1','',50,'pendente')"
        )
        conn.exec_driver_sql(
            "INSERT INTO contas_a_receber VALUES ('r1','u1','Salario',5,'pendente'), ('r2','u1','Bônus',6,'pendente')"
        )
        # Categoria já cadastrada pelo usuário com case diferente: deve ser reaproveitada
        conn.exec_driver_sql("INSERT INTO categorias VALUES ('c1','u1','Transporte','despesa',1)")

        mod._backfill(conn)
        mod._backfill(conn)  # reexecução não duplica

        total = conn.execute(sa.text("SELECT count(*) FROM categorias")).scalar()
        assert total == 2 * _total_padrao()  # u1 reaproveita "Transporte" já existente
        assert conn.execute(
            sa.text("SELECT count(*) FROM categorias WHERE usuario_id='u1' AND lower(nome)='transporte'")
        ).scalar() == 1

        pagar = dict(conn.execute(sa.text("SELECT id, categoria FROM contas_a_pagar")).all())
        assert pagar == {"p1": "moradia", "p2": "lazer", "p3": "Pets", "p4": "moradia", "p5": ""}
        receber = dict(conn.execute(sa.text("SELECT id, origem FROM contas_a_receber")).all())
        assert receber == {"r1": "salario", "r2": "Bônus"}
        # Valores e status intactos
        assert conn.execute(sa.text("SELECT valor, status FROM contas_a_pagar WHERE id='p1'")).one() == (10, "pago")
