"""add_social_auth_fields_to_usuarios

Revision ID: a1b2c3d4e5f6
Revises: fe6c891bab5c
Create Date: 2026-04-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fe6c891bab5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('usuarios', sa.Column('google_id', sa.String(255), nullable=True))
    op.add_column('usuarios', sa.Column('apple_id', sa.String(255), nullable=True))
    op.create_unique_constraint('uq_usuarios_google_id', 'usuarios', ['google_id'])
    op.create_unique_constraint('uq_usuarios_apple_id', 'usuarios', ['apple_id'])
    op.create_index('ix_usuarios_google_id', 'usuarios', ['google_id'])
    op.create_index('ix_usuarios_apple_id', 'usuarios', ['apple_id'])


def downgrade() -> None:
    op.drop_index('ix_usuarios_apple_id', table_name='usuarios')
    op.drop_index('ix_usuarios_google_id', table_name='usuarios')
    op.drop_constraint('uq_usuarios_apple_id', 'usuarios', type_='unique')
    op.drop_constraint('uq_usuarios_google_id', 'usuarios', type_='unique')
    op.drop_column('usuarios', 'apple_id')
    op.drop_column('usuarios', 'google_id')
