"""membros_familia — convites e vínculos de multi-usuário (Plano Pro / Família)

Revision ID: f6a7b8c9d0e1
Revises: f5a6b7c8d9e0
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "f6a7b8c9d0e1"
down_revision = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "membros_familia",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "titular_id",
            UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "membro_id",
            UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pendente"),
        sa.Column("token", sa.String(100), nullable=False, unique=True),
        sa.Column("plano_original", sa.String(20), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("aceito_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_membros_familia_titular_id", "membros_familia", ["titular_id"])
    op.create_index("ix_membros_familia_membro_id", "membros_familia", ["membro_id"])
    op.create_index("ix_membros_familia_email", "membros_familia", ["email"])
    op.create_index("ix_membros_familia_token", "membros_familia", ["token"])


def downgrade() -> None:
    op.drop_index("ix_membros_familia_token", table_name="membros_familia")
    op.drop_index("ix_membros_familia_email", table_name="membros_familia")
    op.drop_index("ix_membros_familia_membro_id", table_name="membros_familia")
    op.drop_index("ix_membros_familia_titular_id", table_name="membros_familia")
    op.drop_table("membros_familia")