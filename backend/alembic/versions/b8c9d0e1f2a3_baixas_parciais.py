"""Historico de baixas e valores parcialmente liquidados."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "b8c9d0e1f2a3"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade():
    for tabela, liquidado in (("contas_a_pagar", "pago"), ("contas_a_receber", "recebido")):
        op.add_column(tabela, sa.Column("valor_baixado", sa.Numeric(12, 2), nullable=False, server_default="0"))
        op.execute(f"UPDATE {tabela} SET valor_baixado = valor WHERE status = '{liquidado}'")
    op.create_table(
        "baixas_contas",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pagar_id", UUID(as_uuid=True), sa.ForeignKey("contas_a_pagar.id", ondelete="CASCADE")),
        sa.Column("receber_id", UUID(as_uuid=True), sa.ForeignKey("contas_a_receber.id", ondelete="CASCADE")),
        sa.Column("valor", sa.Numeric(12, 2), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("meio", sa.String(20), nullable=False),
        sa.Column("conta_id", UUID(as_uuid=True)),
        sa.Column("cartao_id", UUID(as_uuid=True)),
        sa.Column("cancelada_em", sa.DateTime(timezone=True)),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    for campo in ("usuario_id", "pagar_id", "receber_id"):
        op.create_index(f"ix_baixas_contas_{campo}", "baixas_contas", [campo])
    op.execute("""
        INSERT INTO baixas_contas (id, usuario_id, pagar_id, valor, data, meio, conta_id, cartao_id)
        SELECT gen_random_uuid(), usuario_id, id, valor, COALESCE(pago_em::date, data_vencimento),
            CASE WHEN conta_id IS NOT NULL THEN 'conta' WHEN cartao_id IS NOT NULL THEN 'cartao' ELSE 'dinheiro' END,
            conta_id, cartao_id FROM contas_a_pagar WHERE status = 'pago'
    """)
    op.execute("""
        INSERT INTO baixas_contas (id, usuario_id, receber_id, valor, data, meio, conta_id)
        SELECT gen_random_uuid(), usuario_id, id, valor, COALESCE(data_recebimento, recebido_em::date, data_prevista),
            CASE WHEN conta_id IS NOT NULL AND meio_recebimento IS DISTINCT FROM 'dinheiro' THEN 'conta' ELSE 'dinheiro' END,
            CASE WHEN meio_recebimento = 'dinheiro' THEN NULL ELSE conta_id END
        FROM contas_a_receber WHERE status = 'recebido'
    """)


def downgrade():
    op.drop_table("baixas_contas")
    for tabela in ("contas_a_pagar", "contas_a_receber"):
        op.drop_column(tabela, "valor_baixado")
