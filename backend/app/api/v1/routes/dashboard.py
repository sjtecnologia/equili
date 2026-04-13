from datetime import date, timedelta
from calendar import monthrange

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida, DividaPagamento
from app.models.plano_acao import PlanoAcao
from app.models.renda import Renda

router = APIRouter()


def _avancar_mes(d: date) -> date:
    mes_novo = d.month % 12 + 1
    ano_novo = d.year + (1 if d.month == 12 else 0)
    dia_novo = min(d.day, monthrange(ano_novo, mes_novo)[1])
    return date(ano_novo, mes_novo, dia_novo)


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

    # Total a pagar: vencidas (pendentes) + próximos 30 dias
    total_a_pagar_30d = await db.scalar(
        select(func.sum(ContaAPagar.valor)).where(
            ContaAPagar.usuario_id == usuario_id,
            ContaAPagar.status != "pago",
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

    # Próxima conta a vencer (inclui atrasadas — mais urgente primeiro)
    proxima_conta = await db.scalar(
        select(ContaAPagar.data_vencimento).where(
            ContaAPagar.usuario_id == usuario_id,
            ContaAPagar.status == "pendente",
        ).order_by(ContaAPagar.data_vencimento).limit(1)
    )

    # Verificar se tem plano gerado
    plano_count = await db.scalar(
        select(func.count()).where(PlanoAcao.usuario_id == usuario_id)
    ) or 0

    # Parcelas de dívidas atrasadas — usa histórico de pagamentos para detectar gaps
    todas_dividas_result = await db.execute(
        select(Divida).where(
            Divida.usuario_id == usuario_id,
            Divida.quitada == False,  # noqa: E712
        )
    )
    todas_dividas = todas_dividas_result.scalars().all()

    parcelas_atrasadas_total = 0
    valor_parcelas_atrasadas = 0.0
    dividas_com_atraso = 0

    if todas_dividas:
        ids = [d.id for d in todas_dividas]
        pags_result = await db.execute(
            select(DividaPagamento.divida_id, DividaPagamento.data_referencia)
            .where(DividaPagamento.divida_id.in_(ids))
        )
        pagas_por_divida: dict = {}
        for divida_id, data_ref in pags_result:
            pagas_por_divida.setdefault(divida_id, set()).add(data_ref)

        for d in todas_dividas:
            pagas = pagas_por_divida.get(d.id, set())
            n_atraso = 0
            if d.data_primeira_parcela:
                cur = d.data_primeira_parcela
                while cur < hoje:
                    if cur not in pagas:
                        n_atraso += 1
                    cur = _avancar_mes(cur)
            elif d.data_prox_vencimento < hoje:
                cur = d.data_prox_vencimento
                while cur < hoje and n_atraso < d.parcelas_restantes:
                    n_atraso += 1
                    cur = _avancar_mes(cur)

            if n_atraso > 0:
                parcelas_atrasadas_total += n_atraso
                valor_parcelas_atrasadas += n_atraso * float(d.valor_parcela)
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
