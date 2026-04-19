"""add_contas_bancarias_and_cartoes_credito

Revision ID: a1b2c3d4e5f6
Revises: fe6c891bab5c
Create Date: 2026-04-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fe6c891bab5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'contas_bancarias',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('usuario_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('nome', sa.String(100), nullable=False),
        sa.Column('banco', sa.String(80), nullable=False),
        sa.Column('tipo', sa.String(30), nullable=False),
        sa.Column('saldo_inicial', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('cor', sa.String(20), nullable=False, server_default='#2E7D5E'),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_contas_bancarias_usuario_id', 'contas_bancarias', ['usuario_id'])

    op.create_table(
        'cartoes_credito',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('usuario_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('nome', sa.String(100), nullable=False),
        sa.Column('bandeira', sa.String(30), nullable=False),
        sa.Column('limite', sa.Numeric(12, 2), nullable=False),
        sa.Column('dia_fechamento', sa.Integer(), nullable=False),
        sa.Column('dia_vencimento', sa.Integer(), nullable=False),
        sa.Column('cor', sa.String(20), nullable=False, server_default='#1A3C5E'),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_cartoes_credito_usuario_id', 'cartoes_credito', ['usuario_id'])


def downgrade() -> None:
    op.drop_index('ix_cartoes_credito_usuario_id', table_name='cartoes_credito')
    op.drop_table('cartoes_credito')
    op.drop_index('ix_contas_bancarias_usuario_id', table_name='contas_bancarias')
    op.drop_table('contas_bancarias')
