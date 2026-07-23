"""add_listas_tarefas_compras

Revision ID: f7a8b9c0d1e2
Revises: c5d6e7f8a9b0
Create Date: 2026-07-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tarefas (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            titulo VARCHAR(200) NOT NULL,
            concluida BOOLEAN NOT NULL DEFAULT false,
            criado_em TIMESTAMPTZ DEFAULT now(),
            atualizado_em TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_tarefas_usuario_id
        ON tarefas(usuario_id)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS itens_compra (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            nome VARCHAR(200) NOT NULL,
            quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
            unidade VARCHAR(30),
            comprado BOOLEAN NOT NULL DEFAULT false,
            observacao TEXT,
            criado_em TIMESTAMPTZ DEFAULT now(),
            atualizado_em TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_itens_compra_usuario_id
        ON itens_compra(usuario_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS itens_compra")
    op.execute("DROP TABLE IF EXISTS tarefas")
