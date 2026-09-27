"""add_sessoes

Revision ID: c7d0b2016f11
Revises: fe6c891bab5c
Create Date: 2026-09-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7d0b2016f11"
down_revision: Union[str, None] = "fe6c891bab5c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sessoes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("usuario_id", sa.UUID(), nullable=False),
        sa.Column("jti", sa.UUID(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revogada_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    op.create_index(op.f("ix_sessoes_jti"), "sessoes", ["jti"], unique=True)
    op.create_index(op.f("ix_sessoes_usuario_id"), "sessoes", ["usuario_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sessoes_usuario_id"), table_name="sessoes")
    op.drop_index(op.f("ix_sessoes_jti"), table_name="sessoes")
    op.drop_table("sessoes")
