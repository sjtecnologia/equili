"""assinaturas e pagamentos — cobrança com checkout, webhook e gestão

Revision ID: f5a6b7c8d9e0
Revises: f4a5b6c7d8e9
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "f5a6b7c8d9e0"
down_revision = "f4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assinaturas",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "usuario_id",
            UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plano", sa.String(20), nullable=False),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default="aguardando_pagamento",
        ),
        sa.Column("gateway", sa.String(30), nullable=False, server_default="mock"),
        sa.Column("gateway_assinatura_id", sa.String(255), nullable=True),
        sa.Column("preco_mensal", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("data_inicio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_proxima_cobranca", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelada_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_assinaturas_usuario_id", "assinaturas", ["usuario_id"])

    op.create_table(
        "pagamentos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "assinatura_id",
            UUID(as_uuid=True),
            sa.ForeignKey("assinaturas.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "usuario_id",
            UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plano", sa.String(20), nullable=False),
        sa.Column("metodo", sa.String(10), nullable=False),
        sa.Column("valor", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pendente"),
        sa.Column("gateway", sa.String(30), nullable=False, server_default="mock"),
        sa.Column("gateway_pagamento_id", sa.String(255), nullable=True),
        sa.Column("qr_code", sa.Text(), nullable=True),
        sa.Column("qr_base64", sa.Text(), nullable=True),
        sa.Column("url_pagamento", sa.Text(), nullable=True),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("pago_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pagamentos_usuario_id", "pagamentos", ["usuario_id"])
    op.create_index("ix_pagamentos_assinatura_id", "pagamentos", ["assinatura_id"])


def downgrade() -> None:
    op.drop_index("ix_pagamentos_assinatura_id", table_name="pagamentos")
    op.drop_index("ix_pagamentos_usuario_id", table_name="pagamentos")
    op.drop_table("pagamentos")
    op.drop_index("ix_assinaturas_usuario_id", table_name="assinaturas")
    op.drop_table("assinaturas")