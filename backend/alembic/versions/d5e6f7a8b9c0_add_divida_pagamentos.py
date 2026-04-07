"""add_divida_pagamentos

Revision ID: d5e6f7a8b9c0
Revises: fe6c891bab5c
Create Date: 2026-04-07 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'fe6c891bab5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'divida_pagamentos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('divida_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('dividas.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('usuario_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('data_referencia', sa.Date(), nullable=False),
        sa.Column('data_pagamento', sa.Date(), nullable=False),
        sa.Column('valor_pago', sa.Numeric(12, 2), nullable=False),
        sa.Column('valor_parcela_original', sa.Numeric(12, 2), nullable=False),
        sa.Column('observacao', sa.String(300), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('divida_pagamentos')
