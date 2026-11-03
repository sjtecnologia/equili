"""consentimento_ia — autorização explícita para recursos de IA

Revision ID: b7c8d9e0f1a2
Revises: f6a7b8c9d0e1
"""
from alembic import op
import sqlalchemy as sa

revision = "b7c8d9e0f1a2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("consentimento_ia_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "usuarios",
        sa.Column("consentimento_ia_versao", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("usuarios", "consentimento_ia_versao")
    op.drop_column("usuarios", "consentimento_ia_em")
