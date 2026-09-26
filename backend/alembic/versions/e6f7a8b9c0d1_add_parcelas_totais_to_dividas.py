"""add_parcelas_totais_to_dividas

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-04-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'dividas',
        sa.Column('parcelas_totais', sa.SmallInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('dividas', 'parcelas_totais')
