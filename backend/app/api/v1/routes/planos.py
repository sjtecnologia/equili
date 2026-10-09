"""
Planos e assinaturas — catálogo público e entitlements do usuário logado.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import extract, func, select

from app.core import planos as planos_core
from app.core.dependencies import CurrentUserID, DBSession
from app.models.meta import Meta
from app.models.plano_acao import PlanoAcao
from app.models.usuario import Usuario
from app.services import uso_ia as uso_ia_service

router = APIRouter(prefix="/planos", tags=["Planos e Assinaturas"])


@router.get("")
async def listar_planos():
    """Catálogo público de planos — usado na página de preços."""
    return {"planos": planos_core.catalogo()}


@router.get("/me")
async def meu_plano(usuario_id: CurrentUserID, db: DBSession):
    """Entitlements do plano do usuário + uso atual (para exibir cotas)."""
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    plano = planos_core.normalizar_plano(usuario.plano)
    ent = planos_core.entitlements(plano)

    now = datetime.now(timezone.utc)
    planos_ia_usados = await db.scalar(
        select(func.count()).where(
            PlanoAcao.usuario_id == usuario_id,
            extract("month", PlanoAcao.criado_em) == now.month,
            extract("year", PlanoAcao.criado_em) == now.year,
        )
    )
    chat_usado = await uso_ia_service.contar_uso(db, usuario_id, "chat")
    metas_ativas = await db.scalar(
        select(func.count()).where(
            Meta.usuario_id == usuario_id,
            Meta.concluida == False,  # noqa: E712
        )
    )

    return {
        **ent,
        "uso": {
            "planos_ia_mes": int(planos_ia_usados or 0),
            "chat_msgs_mes": chat_usado,
            "metas_ativas": int(metas_ativas or 0),
        },
    }