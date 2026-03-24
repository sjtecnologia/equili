from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.divida import Divida
from app.models.plano_acao import PlanoAcao
from app.models.renda import Renda

router = APIRouter()


@router.get("/resumo")
async def resumo_dashboard(usuario_id: CurrentUserID, db: DBSession):
    # Renda total mensal
    renda_total = await db.scalar(
        select(func.sum(Renda.valor)).where(
            Renda.usuario_id == usuario_id, Renda.ativo == True  # noqa: E712
        )
    ) or 0.0

    # Total de dívidas
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

    # Verificar se tem plano gerado
    plano_count = await db.scalar(
        select(func.count()).where(PlanoAcao.usuario_id == usuario_id)
    ) or 0

    saldo_disponivel = float(renda_total) - float(total_dividas_ativas)

    return {
        "renda_total": float(renda_total),
        "total_despesas_fixas": 0.0,  # Sprint 2
        "total_despesas_variaveis": 0.0,  # Sprint 2
        "total_dividas": float(total_dividas),
        "saldo_disponivel": float(renda_total),
        "total_dividas_ativas": total_dividas_ativas,
        "plano_gerado": plano_count > 0,
    }
