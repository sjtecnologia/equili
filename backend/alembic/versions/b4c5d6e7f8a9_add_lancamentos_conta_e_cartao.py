"""add_lancamentos_conta_e_cartao

Revision ID: b4c5d6e7f8a9
Revises: a1b2c3d4e5f6
Create Date: 2026-04-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lancamentos_conta',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('conta_bancaria_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contas_bancarias.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('descricao', sa.String(255), nullable=False),
        sa.Column('valor', sa.Numeric(12, 2), nullable=False),
        sa.Column('tipo', sa.String(10), nullable=False),
        sa.Column('data', sa.Date, nullable=False),
        sa.Column('categoria', sa.String(80), nullable=True),
        sa.Column('origem', sa.String(20), nullable=False, server_default='manual'),
        sa.Column('ofx_id', sa.String(100), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lancamentos_conta_conta_bancaria_id', 'lancamentos_conta', ['conta_bancaria_id'])
    op.create_index('ix_lancamentos_conta_data', 'lancamentos_conta', ['data'])

    op.create_table(
        'lancamentos_cartao',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('cartao_credito_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('cartoes_credito.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('descricao', sa.String(255), nullable=False),
        sa.Column('valor', sa.Numeric(12, 2), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('data', sa.Date, nullable=False),
        sa.Column('categoria', sa.String(80), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lancamentos_cartao_cartao_credito_id', 'lancamentos_cartao', ['cartao_credito_id'])
    op.create_index('ix_lancamentos_cartao_data', 'lancamentos_cartao', ['data'])


def downgrade() -> None:
    op.drop_index('ix_lancamentos_cartao_data', table_name='lancamentos_cartao')
    op.drop_index('ix_lancamentos_cartao_cartao_credito_id', table_name='lancamentos_cartao')
    op.drop_table('lancamentos_cartao')
    op.drop_index('ix_lancamentos_conta_data', table_name='lancamentos_conta')
    op.drop_index('ix_lancamentos_conta_conta_bancaria_id', table_name='lancamentos_conta')
    op.drop_table('lancamentos_conta')
