from datetime import date
import re

from fastapi import APIRouter, Query, HTTPException
from sqlalchemy import func, select
from sqlalchemy import extract as sql_extract

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_lancamento import ContaAPagar, ContaAReceber

router = APIRouter()


def filtros_relatorio(model, receber, tipo, status, categoria, q, data_inicio, data_fim):
    if data_inicio and data_fim and data_inicio > data_fim:
        raise HTTPException(422, "Data inicial deve ser anterior ou igual a data final.")
    filtros = []
    vencimento = model.data_prevista if receber else model.data_vencimento
    if tipo in {"avulsa", "recorrente", "parcelada"}:
        filtros.append(model.tipo == (tipo if receber else {"avulsa": "avulsa", "recorrente": "fixa", "parcelada": "variavel"}[tipo]))
    if status == "liquidado":
        filtros.append(model.status == ("recebido" if receber else "pago"))
    elif status == "pendente":
        filtros.append(model.valor_baixado < model.valor)
    elif status == "parcial":
        filtros.extend([model.valor_baixado > 0, model.valor_baixado < model.valor])
    elif status == "vencido":
        filtros.extend([model.valor_baixado < model.valor, vencimento < date.today()])
    if categoria:
        filtros.append(func.lower(func.trim(model.origem if receber else model.categoria)) == categoria.strip().lower())
    if q and q.strip():
        termo = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        filtros.append(model.descricao.ilike(f"%{termo}%", escape="\\"))
    if data_inicio:
        filtros.append(vencimento >= data_inicio)
    if data_fim:
        filtros.append(vencimento <= data_fim)
    return filtros


@router.get("/parcelas")
async def relatorio_parcelas(
    usuario_id: CurrentUserID, db: DBSession,
    natureza: str | None = None, tipo: str | None = None, status: str | None = None,
    categoria: str | None = None, q: str | None = None, parcela: int | None = None,
    data_inicio: date | None = None, data_fim: date | None = None,
    conta_id: str | None = None, cartao_id: str | None = None,
):
    from uuid import UUID
    from sqlalchemy import or_
    from app.models.conta_lancamento import BaixaConta
    if data_inicio and data_fim and data_inicio > data_fim:
        raise HTTPException(422, "Data inicial deve ser anterior ou igual a data final.")
    try:
        banco = UUID(conta_id) if conta_id else None
        cartao = UUID(cartao_id) if cartao_id else None
    except ValueError:
        raise HTTPException(422, "Identificador de conta ou cartao invalido.")
    if natureza not in (None, "", "pagar", "receber") or tipo not in (None, "", "avulsa", "recorrente", "parcelada") or status not in (None, "", "pendente", "parcial", "liquidado", "vencido"):
        raise HTTPException(422, "Filtro de relatorio invalido.")
    linhas = []
    for receber, model in ((False, ContaAPagar), (True, ContaAReceber)):
        lado = "receber" if receber else "pagar"
        if natureza and natureza != lado:
            continue
        vencimento = model.data_prevista if receber else model.data_vencimento
        categoria_col = model.origem if receber else model.categoria
        query = select(model).where(model.usuario_id == usuario_id)
        if tipo:
            tipo_real = tipo if receber else {"avulsa": "avulsa", "recorrente": "fixa", "parcelada": "variavel"}[tipo]
            query = query.where(model.tipo == tipo_real)
        if status == "liquidado":
            query = query.where(model.status == ("recebido" if receber else "pago"))
        elif status == "parcial":
            query = query.where(model.valor_baixado > 0, model.valor_baixado < model.valor)
        elif status == "vencido":
            query = query.where(model.valor_baixado < model.valor, vencimento < date.today())
        elif status == "pendente":
            query = query.where(model.valor_baixado < model.valor)
        if categoria:
            query = query.where(func.lower(func.trim(categoria_col)) == categoria.strip().lower())
        if data_inicio:
            query = query.where(vencimento >= data_inicio)
        if data_fim:
            query = query.where(vencimento <= data_fim)
        if q and q.strip():
            termo = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            busca = model.descricao.ilike(f"%{termo}%", escape="\\")
            if receber:
                busca = or_(busca, model.devedor.ilike(f"%{termo}%", escape="\\"))
            query = query.where(busca)
        if parcela is not None:
            query = query.where(model.descricao.like(f"%({parcela}/%"))
        if banco or cartao:
            vinculo = BaixaConta.receber_id if receber else BaixaConta.pagar_id
            baixas = select(BaixaConta.id).where(vinculo == model.id, BaixaConta.cancelada_em.is_(None))
            if banco:
                baixas = baixas.where(BaixaConta.conta_id == banco)
            if cartao:
                baixas = baixas.where(BaixaConta.cartao_id == cartao)
            query = query.where(baixas.exists())
        for c in (await db.scalars(query.order_by(vencimento, model.descricao, model.id))).all():
            numero = re.search(r"\((\d+)/(\d+)\)$", c.descricao)
            restante = float(c.valor - c.valor_baixado)
            situacao = "liquidado" if restante == 0 else "parcial" if c.valor_baixado else "vencido" if getattr(c, "data_prevista" if receber else "data_vencimento") < date.today() else "pendente"
            linhas.append({
                "id": str(c.id), "natureza": lado, "descricao": c.descricao,
                "categoria": c.origem if receber else c.categoria,
                "tipo": c.tipo if receber else {"avulsa": "avulsa", "fixa": "recorrente", "variavel": "parcelada"}.get(c.tipo, c.tipo),
                "parcela": f"{numero[1]}/{numero[2]}" if numero else "",
                "vencimento": str(c.data_prevista if receber else c.data_vencimento),
                "status": situacao, "valor": float(c.valor), "valor_baixado": float(c.valor_baixado),
                "saldo_restante": restante, "devedor": c.devedor if receber else None,
                "observacao": c.observacao,
            })
    return sorted(linhas, key=lambda l: (l["vencimento"], l["descricao"], l["id"]))

MESES_PT = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


@router.get("/fluxo-caixa")
async def fluxo_caixa(
    ano: int, usuario_id: CurrentUserID, db: DBSession,
    tipo: str | None = None, status: str | None = None, categoria: str | None = None,
    q: str | None = None, data_inicio: date | None = None, data_fim: date | None = None,
):
    """Retorna entradas e saídas mensais para o ano informado."""
    resultado = []
    for mes in range(1, 13):
        total_entradas = await db.scalar(
            select(func.sum(ContaAReceber.valor)).where(
                *filtros_relatorio(ContaAReceber, True, tipo, status, categoria, q, data_inicio, data_fim),
                ContaAReceber.usuario_id == usuario_id,
                sql_extract("month", ContaAReceber.data_prevista) == mes,
                sql_extract("year", ContaAReceber.data_prevista) == ano,
            )
        ) or 0.0

        total_saidas = await db.scalar(
            select(func.sum(ContaAPagar.valor)).where(
                *filtros_relatorio(ContaAPagar, False, tipo, status, categoria, q, data_inicio, data_fim),
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
    mes: int, ano: int, usuario_id: CurrentUserID, db: DBSession,
    tipo: str | None = None, status: str | None = None, categoria: str | None = None,
    q: str | None = None, data_inicio: date | None = None, data_fim: date | None = None,
):
    """Retorna lançamentos detalhados do mês para visualização e exportação."""
    result_pagar = await db.execute(
        select(ContaAPagar)
        .where(
            *filtros_relatorio(ContaAPagar, False, tipo, status, categoria, q, data_inicio, data_fim),
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
            *filtros_relatorio(ContaAReceber, True, tipo, status, categoria, q, data_inicio, data_fim),
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
                "valor_baixado": float(c.valor_baixado),
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
                "valor_baixado": float(c.valor_baixado),
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
    tipo: str | None = None, status: str | None = None, categoria: str | None = None,
    q: str | None = None,
):
    """Retorna contas a pagar com vencimento na data informada."""
    result = await db.execute(
        select(ContaAPagar)
        .where(
            *filtros_relatorio(ContaAPagar, False, tipo, status, categoria, q, None, None),
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
