"""metas — metas financeiras com valor alvo, prazo e progresso

Revision ID: f4a5b6c7d8e9
Revises: e1a2b3c4d5e6
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "f4a5b6c7d8e9"
down_revision = "e1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "metas",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "usuario_id",
            UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("titulo", sa.String(150), nullable=False),
        sa.Column("descricao", sa.String(500), nullable=True),
        sa.Column("categoria", sa.String(50), nullable=True),
        sa.Column("valor_alvo", sa.Numeric(12, 2), nullable=False),
        sa.Column("valor_atual", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("prazo", sa.Date(), nullable=True),
        sa.Column("concluida", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_metas_usuario_id", "metas", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_metas_usuario_id", table_name="metas")
    op.drop_table("metas")