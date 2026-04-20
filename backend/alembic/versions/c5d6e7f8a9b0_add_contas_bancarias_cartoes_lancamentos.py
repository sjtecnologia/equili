"""add_contas_bancarias_cartoes_e_lancamentos

Revision ID: c5d6e7f8a9b0
Revises: a1b2c3d4e5f6
Create Date: 2026-04-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Usa SQL direto com IF NOT EXISTS para ser idempotente
    op.execute("""
        CREATE TABLE IF NOT EXISTS contas_bancarias (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            nome VARCHAR(100) NOT NULL,
            banco VARCHAR(80) NOT NULL,
            tipo VARCHAR(30) NOT NULL,
            saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
            cor VARCHAR(20) NOT NULL DEFAULT '#2E7D5E',
            ativo BOOLEAN NOT NULL DEFAULT true,
            criado_em TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_contas_bancarias_usuario_id
        ON contas_bancarias(usuario_id)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS cartoes_credito (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            nome VARCHAR(100) NOT NULL,
            bandeira VARCHAR(30) NOT NULL,
            limite NUMERIC(12,2) NOT NULL,
            dia_fechamento INTEGER NOT NULL,
            dia_vencimento INTEGER NOT NULL,
            cor VARCHAR(20) NOT NULL DEFAULT '#1A3C5E',
            ativo BOOLEAN NOT NULL DEFAULT true,
            criado_em TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_cartoes_credito_usuario_id
        ON cartoes_credito(usuario_id)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS lancamentos_conta (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conta_bancaria_id UUID NOT NULL REFERENCES contas_bancarias(id) ON DELETE CASCADE,
            descricao VARCHAR(255) NOT NULL,
            valor NUMERIC(12,2) NOT NULL,
            tipo VARCHAR(10) NOT NULL,
            data DATE NOT NULL,
            categoria VARCHAR(80),
            origem VARCHAR(20) NOT NULL DEFAULT 'manual',
            ofx_id VARCHAR(100),
            criado_em TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_lancamentos_conta_conta_bancaria_id
        ON lancamentos_conta(conta_bancaria_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_lancamentos_conta_data
        ON lancamentos_conta(data)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS lancamentos_cartao (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cartao_credito_id UUID NOT NULL REFERENCES cartoes_credito(id) ON DELETE CASCADE,
            descricao VARCHAR(255) NOT NULL,
            valor NUMERIC(12,2) NOT NULL,
            tipo VARCHAR(20) NOT NULL,
            data DATE NOT NULL,
            categoria VARCHAR(80),
            criado_em TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_lancamentos_cartao_cartao_credito_id
        ON lancamentos_cartao(cartao_credito_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_lancamentos_cartao_data
        ON lancamentos_cartao(data)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS lancamentos_cartao")
    op.execute("DROP TABLE IF EXISTS lancamentos_conta")
    op.execute("DROP TABLE IF EXISTS cartoes_credito")
    op.execute("DROP TABLE IF EXISTS contas_bancarias")
