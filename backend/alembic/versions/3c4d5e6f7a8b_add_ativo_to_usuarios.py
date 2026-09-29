"""add ativo to usuarios

Revision ID: 3c4d5e6f7a8b
Revises: 2b3c4d5e6f7a
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3c4d5e6f7a8b"
down_revision: Union[str, None] = "2b3c4d5e6f7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column(
            "ativo",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("usuarios", "ativo")
