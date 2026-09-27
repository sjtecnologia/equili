"""merge multiple heads

Revision ID: a7eb4b8810d8
Revises: c7d0b2016f11, f7a8b9c0d1e2
Create Date: 2026-09-27 17:46:20.507896

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7eb4b8810d8'
down_revision: Union[str, None] = ('c7d0b2016f11', 'f7a8b9c0d1e2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
