from datetime import date, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida
from app.models.plano_acao import PlanoAcao
from app.models.renda import Renda

router = APIRouter()


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
    }
