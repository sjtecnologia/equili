"""backfill categorias padrão por usuário e normalização de lançamentos

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Snapshot das listas fixas antigas (CATEGORIAS_VALIDAS / ORIGENS_VALIDAS).
PADRAO = {
    "despesa": ("moradia", "transporte", "saude", "educacao", "alimentacao", "lazer", "outro"),
    "receita": ("salario", "freela", "venda", "emprestimo", "outro"),
}
# tipo -> (tabela, coluna de texto da conta)
CONTAS = {
    "despesa": ("contas_a_pagar", "categoria"),
    "receita": ("contas_a_receber", "origem"),
}


def _backfill(conn) -> None:
    usuarios = [row[0] for row in conn.execute(sa.text("SELECT id FROM usuarios"))]
    for usuario_id in usuarios:
        existentes = {
            (tipo, nome.strip().lower()): nome
            for tipo, nome in conn.execute(
                sa.text("SELECT tipo, nome FROM categorias WHERE usuario_id = :u"), {"u": usuario_id}
            )
        }
        for tipo, nomes in PADRAO.items():
            tabela, coluna = CONTAS[tipo]
            for nome in nomes:
                # Reaproveita categoria já cadastrada com case diferente, evitando duplicata visual
                canonico = existentes.get((tipo, nome))
                if canonico is None:
                    conn.execute(
                        sa.text(
                            "INSERT INTO categorias (id, usuario_id, nome, tipo, ativo) "
                            "VALUES (:id, :u, :nome, :tipo, :ativo) "
                            "ON CONFLICT (usuario_id, tipo, nome) DO NOTHING"
                        ),
                        {"id": str(uuid.uuid4()), "u": usuario_id, "nome": nome, "tipo": tipo, "ativo": True},
                    )
                    canonico = nome
                # Só o campo de texto da categoria é tocado; categorias livres não casam e ficam como estão
                conn.execute(
                    sa.text(
                        f"UPDATE {tabela} SET {coluna} = :c "
                        f"WHERE usuario_id = :u AND lower(trim({coluna})) = lower(:c) AND {coluna} <> :c"
                    ),
                    {"c": canonico, "u": usuario_id},
                )


def upgrade() -> None:
    _backfill(op.get_bind())


def downgrade() -> None:
    # Dados semeados e normalizados não são revertidos.
    pass
