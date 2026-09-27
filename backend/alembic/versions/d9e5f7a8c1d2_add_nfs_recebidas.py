"""add_nfs_recebidas

Revision ID: d9e5f7a8c1d2
Revises: a7eb4b8810d8
Create Date: 2026-09-27 19:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d9e5f7a8c1d2"
down_revision: Union[str, None] = "a7eb4b8810d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "nfs_recebidas",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("numero", sa.String(length=50), nullable=False),
        sa.Column("serie", sa.String(length=20), nullable=True),
        sa.Column("valor", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("chave_acesso", sa.String(length=255), nullable=False),
        sa.Column("codigo_verificacao", sa.String(length=100), nullable=True),
        sa.Column("cpf_cnpj", sa.String(length=30), nullable=True),
        sa.Column("inscricao_municipal", sa.String(length=50), nullable=True),
        sa.Column("url_consulta", sa.String(length=500), nullable=True),
        sa.Column("data_emissao", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_nfs_recebidas_chave_acesso"), "nfs_recebidas", ["chave_acesso"], unique=False)
    op.create_index(op.f("ix_nfs_recebidas_user_id"), "nfs_recebidas", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_nfs_recebidas_user_id"), table_name="nfs_recebidas")
    op.drop_index(op.f("ix_nfs_recebidas_chave_acesso"), table_name="nfs_recebidas")
    op.drop_table("nfs_recebidas")
