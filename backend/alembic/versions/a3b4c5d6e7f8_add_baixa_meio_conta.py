"""add meio/conta de baixa em contas a pagar e a receber

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("contas_a_receber", sa.Column("data_recebimento", sa.Date(), nullable=True))
    op.add_column("contas_a_receber", sa.Column("meio_recebimento", sa.String(20), nullable=True))
    op.add_column(
        "contas_a_receber",
        sa.Column(
            "conta_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contas_bancarias.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "contas_a_pagar",
        sa.Column(
            "conta_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contas_bancarias.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "contas_a_pagar",
        sa.Column(
            "cartao_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cartoes_credito.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("contas_a_pagar", "cartao_id")
    op.drop_column("contas_a_pagar", "conta_id")
    op.drop_column("contas_a_receber", "conta_id")
    op.drop_column("contas_a_receber", "meio_recebimento")
    op.drop_column("contas_a_receber", "data_recebimento")
