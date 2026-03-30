"""add_contas_lancamentos

Revision ID: a2f3c4e5b6d7
Revises: 50cce3ecfaee
Create Date: 2026-03-30 10:00:00.000000

Adiciona tabelas contas_a_pagar e contas_a_receber para controle
de fluxo de caixa real — usadas também no contexto do Plano de Ação IA.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a2f3c4e5b6d7"
down_revision: Union[str, None] = "50cce3ecfaee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contas_a_pagar",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("usuario_id", sa.UUID(), nullable=False),
        sa.Column("conta_fixa_id", sa.UUID(), nullable=True),
        sa.Column("descricao", sa.String(length=150), nullable=False),
        sa.Column("categoria", sa.String(length=50), nullable=False),
        sa.Column("valor", sa.Numeric(12, 2), nullable=False),
        sa.Column("data_vencimento", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pendente"),
        sa.Column("tipo", sa.String(length=20), nullable=False, server_default="avulsa"),
        sa.Column("pago_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["conta_fixa_id"], ["contas_fixas.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_contas_a_pagar_usuario_id"), "contas_a_pagar", ["usuario_id"], unique=False
    )
    op.create_index(
        op.f("ix_contas_a_pagar_data_vencimento"),
        "contas_a_pagar",
        ["data_vencimento"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contas_a_pagar_conta_fixa_id"),
        "contas_a_pagar",
        ["conta_fixa_id"],
        unique=False,
    )

    op.create_table(
        "contas_a_receber",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("usuario_id", sa.UUID(), nullable=False),
        sa.Column("renda_id", sa.UUID(), nullable=True),
        sa.Column("descricao", sa.String(length=150), nullable=False),
        sa.Column("origem", sa.String(length=30), nullable=False),
        sa.Column("valor", sa.Numeric(12, 2), nullable=False),
        sa.Column("data_prevista", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pendente"),
        sa.Column("devedor", sa.String(length=150), nullable=True),
        sa.Column("recebido_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["renda_id"], ["rendas.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_contas_a_receber_usuario_id"),
        "contas_a_receber",
        ["usuario_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contas_a_receber_data_prevista"),
        "contas_a_receber",
        ["data_prevista"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contas_a_receber_renda_id"),
        "contas_a_receber",
        ["renda_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_contas_a_receber_renda_id"), table_name="contas_a_receber")
    op.drop_index(
        op.f("ix_contas_a_receber_data_prevista"), table_name="contas_a_receber"
    )
    op.drop_index(
        op.f("ix_contas_a_receber_usuario_id"), table_name="contas_a_receber"
    )
    op.drop_table("contas_a_receber")

    op.drop_index(
        op.f("ix_contas_a_pagar_conta_fixa_id"), table_name="contas_a_pagar"
    )
    op.drop_index(
        op.f("ix_contas_a_pagar_data_vencimento"), table_name="contas_a_pagar"
    )
    op.drop_index(op.f("ix_contas_a_pagar_usuario_id"), table_name="contas_a_pagar")
    op.drop_table("contas_a_pagar")
