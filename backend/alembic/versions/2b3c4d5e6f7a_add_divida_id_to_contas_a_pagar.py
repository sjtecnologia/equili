"""add divida_id to contas_a_pagar

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "2b3c4d5e6f7a"
down_revision: Union[str, None] = "1a2b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("contas_a_pagar", sa.Column("divida_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_contas_a_pagar_divida_id",
        "contas_a_pagar",
        "dividas",
        ["divida_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_contas_a_pagar_divida_id", "contas_a_pagar", ["divida_id"])


def downgrade() -> None:
    op.drop_index("ix_contas_a_pagar_divida_id", table_name="contas_a_pagar")
    op.drop_constraint("fk_contas_a_pagar_divida_id", "contas_a_pagar", type_="foreignkey")
    op.drop_column("contas_a_pagar", "divida_id")
