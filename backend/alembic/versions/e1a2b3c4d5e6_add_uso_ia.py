"""uso_ia — contador mensal de uso de IA (cotas por plano)

Revision ID: e1a2b3c4d5e6
Revises: b8c9d0e1f2a3
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "e1a2b3c4d5e6"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "uso_ia",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "usuario_id",
            UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("recurso", sa.String(30), nullable=False),
        sa.Column("periodo", sa.String(7), nullable=False),  # YYYY-MM
        sa.Column("contador", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "usuario_id", "recurso", "periodo", name="uq_uso_ia_usuario_recurso_periodo"
        ),
    )
    op.create_index("ix_uso_ia_usuario_id", "uso_ia", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_uso_ia_usuario_id", table_name="uso_ia")
    op.drop_table("uso_ia")