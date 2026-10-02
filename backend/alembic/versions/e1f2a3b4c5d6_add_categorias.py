"""add categorias

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categorias",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "usuario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nome", sa.String(80), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("cor", sa.String(20), nullable=True),
        sa.Column("icone", sa.String(50), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("usuario_id", "tipo", "nome", name="uq_categorias_usuario_tipo_nome"),
    )
    op.create_index("ix_categorias_usuario_id", "categorias", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_categorias_usuario_id", table_name="categorias")
    op.drop_table("categorias")
