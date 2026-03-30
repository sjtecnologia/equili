"""add_tipo_to_contas_receber

Revision ID: b3c4d5e6f7a8
Revises: a2f3c4e5b6d7
Create Date: 2026-03-30 11:00:00.000000

Adiciona coluna `tipo` (recorrente | parcelada | avulsa) em contas_a_receber
para suportar geração automática em lote.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a2f3c4e5b6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "contas_a_receber",
        sa.Column(
            "tipo",
            sa.String(length=20),
            nullable=False,
            server_default="avulsa",
        ),
    )


def downgrade() -> None:
    op.drop_column("contas_a_receber", "tipo")
