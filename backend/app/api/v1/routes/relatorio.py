from datetime import date

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy import extract as sql_extract

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_lancamento import ContaAPagar, ContaAReceber

router = APIRouter()

MESES_PT = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


@router.get("/fluxo-caixa")
async def fluxo_caixa(ano: int, usuario_id: CurrentUserID, db: DBSession):
    """Retorna entradas e saídas mensais para o ano informado."""
    resultado = []
    for mes in range(1, 13):
        total_entradas = await db.scalar(
            select(func.sum(ContaAReceber.valor)).where(
                ContaAReceber.usuario_id == usuario_id,
                sql_extract("month", ContaAReceber.data_prevista) == mes,
                sql_extract("year", ContaAReceber.data_prevista) == ano,
            )
        ) or 0.0

        total_saidas = await db.scalar(
            select(func.sum(ContaAPagar.valor)).where(
                ContaAPagar.usuario_id == usuario_id,
                sql_extract("month", ContaAPagar.data_vencimento) == mes,
                sql_extract("year", ContaAPagar.data_vencimento) == ano,
            )
        ) or 0.0

        resultado.append({
            "mes": mes,
            "mes_nome": MESES_PT[mes],
            "ano": ano,
            "entradas": float(total_entradas),
            "saidas": float(total_saidas),
            "saldo": float(total_entradas) - float(total_saidas),
        })

    return resultado


@router.get("/detalhado")
async def relatorio_detalhado(
    mes: int, ano: int, usuario_id: CurrentUserID, db: DBSession
):
    """Retorna lançamentos detalhados do mês para visualização e exportação."""
    result_pagar = await db.execute(
        select(ContaAPagar)
        .where(
            ContaAPagar.usuario_id == usuario_id,
            sql_extract("month", ContaAPagar.data_vencimento) == mes,
            sql_extract("year", ContaAPagar.data_vencimento) == ano,
        )
        .order_by(ContaAPagar.data_vencimento)
    )
    contas_pagar = result_pagar.scalars().all()

    result_receber = await db.execute(
        select(ContaAReceber)
        .where(
            ContaAReceber.usuario_id == usuario_id,
            sql_extract("month", ContaAReceber.data_prevista) == mes,
            sql_extract("year", ContaAReceber.data_prevista) == ano,
        )
        .order_by(ContaAReceber.data_prevista)
    )
    contas_receber = result_receber.scalars().all()

    total_pagar = sum(float(c.valor) for c in contas_pagar)
    total_receber = sum(float(c.valor) for c in contas_receber)

    return {
        "contas_pagar": [
            {
                "id": str(c.id),
                "descricao": c.descricao,
                "categoria": c.categoria,
                "valor": float(c.valor),
                "data_vencimento": str(c.data_vencimento),
                "status": c.status,
                "tipo": c.tipo,
                "observacao": c.observacao,
            }
            for c in contas_pagar
        ],
        "contas_receber": [
            {
                "id": str(c.id),
                "descricao": c.descricao,
                "origem": c.origem,
                "valor": float(c.valor),
                "data_prevista": str(c.data_prevista),
                "status": c.status,
                "tipo": c.tipo,
                "devedor": c.devedor,
                "observacao": c.observacao,
            }
            for c in contas_receber
        ],
        "totais": {
            "total_pagar": total_pagar,
            "total_receber": total_receber,
            "saldo": total_receber - total_pagar,
        },
    }


@router.get("/contas-pagar-dia")
async def contas_pagar_por_dia(
    data: date,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    """Retorna contas a pagar com vencimento na data informada."""
    result = await db.execute(
        select(ContaAPagar)
        .where(
            ContaAPagar.usuario_id == usuario_id,
            ContaAPagar.data_vencimento == data,
        )
        .order_by(ContaAPagar.categoria, ContaAPagar.descricao)
    )
    contas = result.scalars().all()
    total = sum(float(c.valor) for c in contas)

    return {
        "data": data.isoformat(),
        "total": total,
        "contas": [
            {
                "id": str(c.id),
                "descricao": c.descricao,
                "categoria": c.categoria,
                "valor": float(c.valor),
                "status": c.status,
                "tipo": c.tipo,
                "observacao": c.observacao,
            }
            for c in contas
        ],
    }
