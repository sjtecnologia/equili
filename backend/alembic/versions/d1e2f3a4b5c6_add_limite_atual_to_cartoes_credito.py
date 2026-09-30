"""add limite_atual to cartoes_credito

Revision ID: d1e2f3a4b5c6
Revises: 3c4d5e6f7a8b
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "3c4d5e6f7a8b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cartoes_credito",
        sa.Column("limite_atual", sa.Numeric(14, 2), nullable=True),
    )
    # Backfill: sem histórico de uso, assume-se limite integral disponível
    op.execute("UPDATE cartoes_credito SET limite_atual = limite")
    op.alter_column("cartoes_credito", "limite_atual", nullable=False)


def downgrade() -> None:
    op.drop_column("cartoes_credito", "limite_atual")
