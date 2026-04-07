from datetime import date, timedelta
from calendar import monthrange

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida
from app.models.plano_acao import PlanoAcao
from app.models.renda import Renda

router = APIRouter()


def _avancar_mes(d: date) -> date:
    mes_novo = d.month % 12 + 1
    ano_novo = d.year + (1 if d.month == 12 else 0)
    dia_novo = min(d.day, monthrange(ano_novo, mes_novo)[1])
    return date(ano_novo, mes_novo, dia_novo)


def _parcelas_atrasadas(data_prox: date, parcelas_restantes: int, hoje: date) -> int:
    """Conta quantas parcelas venceram sem pagamento (data_prox < hoje)."""
    if data_prox >= hoje:
        return 0
    count = 0
    base = data_prox
    while base < hoje and count < parcelas_restantes:
        count += 1
        base = _avancar_mes(base)
    return count


@router.get("/resumo")
async def resumo_dashboard(usuario_id: CurrentUserID, db: DBSession):
    hoje = date.today()
    em_30_dias = hoje + timedelta(days=30)

    # Renda total mensal (fontes recorrentes)
    renda_total = await db.scalar(
        select(func.sum(Renda.valor)).where(
            Renda.usuario_id == usuario_id, Renda.ativo == True  # noqa: E712
        )
    ) or 0.0

    # Total de dívidas ativas
    total_dividas = await db.scalar(
        select(func.sum(Divida.valor_total)).where(
            Divida.usuario_id == usuario_id, Divida.quitada == False  # noqa: E712
        )
    ) or 0.0

    # Contagem de dívidas ativas
    total_dividas_ativas = await db.scalar(
        select(func.count()).where(
            Divida.usuario_id == usuario_id, Divida.quitada == False  # noqa: E712
        )
    ) or 0

    # Total a pagar nos próximos 30 dias (pendente/vencido)
    total_a_pagar_30d = await db.scalar(
        select(func.sum(ContaAPagar.valor)).where(
            ContaAPagar.usuario_id == usuario_id,
            ContaAPagar.status != "pago",
            ContaAPagar.data_vencimento >= hoje,
            ContaAPagar.data_vencimento <= em_30_dias,
        )
    ) or 0.0

    # Total a receber nos próximos 30 dias (pendente/atrasado)
    total_a_receber_30d = await db.scalar(
        select(func.sum(ContaAReceber.valor)).where(
            ContaAReceber.usuario_id == usuario_id,
            ContaAReceber.status != "recebido",
            ContaAReceber.data_prevista >= hoje,
            ContaAReceber.data_prevista <= em_30_dias,
        )
    ) or 0.0

    # Próxima conta a vencer
    proxima_conta = await db.scalar(
        select(ContaAPagar.data_vencimento).where(
            ContaAPagar.usuario_id == usuario_id,
            ContaAPagar.status == "pendente",
            ContaAPagar.data_vencimento >= hoje,
        ).order_by(ContaAPagar.data_vencimento).limit(1)
    )

    # Verificar se tem plano gerado
    plano_count = await db.scalar(
        select(func.count()).where(PlanoAcao.usuario_id == usuario_id)
    ) or 0

    # Parcelas de dívidas atrasadas (data_prox_vencimento antes de hoje)
    result_dividas = await db.execute(
        select(Divida).where(
            Divida.usuario_id == usuario_id,
            Divida.quitada == False,  # noqa: E712
            Divida.data_prox_vencimento < hoje,
        )
    )
    dividas_atrasadas = result_dividas.scalars().all()
    parcelas_atrasadas_total = 0
    valor_parcelas_atrasadas = 0.0
    dividas_com_atraso = 0
    for d in dividas_atrasadas:
        n = _parcelas_atrasadas(d.data_prox_vencimento, d.parcelas_restantes, hoje)
        if n > 0:
            parcelas_atrasadas_total += n
            valor_parcelas_atrasadas += n * float(d.valor_parcela)
            dividas_com_atraso += 1

    # Saldo projetado real: renda + a_receber - a_pagar
    saldo_projetado = (
        float(renda_total) + float(total_a_receber_30d) - float(total_a_pagar_30d)
    )

    return {
        "renda_total": float(renda_total),
        "total_despesas_fixas": 0.0,  # Sprint 2
        "total_despesas_variaveis": 0.0,  # Sprint 2
        "total_dividas": float(total_dividas),
        "total_dividas_ativas": total_dividas_ativas,
        "total_a_pagar_30d": float(total_a_pagar_30d),
        "total_a_receber_30d": float(total_a_receber_30d),
        "saldo_disponivel": float(renda_total),  # renda recorrente
        "saldo_projetado_30d": saldo_projetado,  # fluxo de caixa real
        "proxima_conta_vencimento": proxima_conta.isoformat() if proxima_conta else None,
        "dias_proxima_conta": (proxima_conta - hoje).days if proxima_conta else None,
        "plano_gerado": plano_count > 0,
        "parcelas_atrasadas_total": parcelas_atrasadas_total,
        "valor_parcelas_atrasadas": valor_parcelas_atrasadas,
        "dividas_com_atraso": dividas_com_atraso,
    }
