"""
Assinaturas e cobrança — checkout (PIX/cartão), webhook de confirmação e
cancelamento.

O preço SEMPRE vem do catálogo de planos (o cliente nunca manda valor). O
pagamento é confirmado pelo webhook do gateway — em desenvolvimento o gateway
``mock`` permite simular a aprovação, exercitando exatamente o mesmo caminho
que um provedor real (Asaas/Appmax/Stripe) vai usar.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select

from app.core import planos as planos_core
from app.core.config import settings
from app.core.dependencies import CurrentUserID, DBSession
from app.models.assinatura import Assinatura, Pagamento
from app.models.usuario import Usuario
from app.services import familia as familia_service
from app.services.gateways import (
    GC_MOCK,
    METODO_CARTAO,
    METODO_PIX,
    WebhookEvento,
    obter_gateway,
)

router = APIRouter(tags=["Assinaturas e Pagamentos"])

METODOS_VALIDOS = {METODO_PIX, METODO_CARTAO}
PLANOS_ASSINAVEIS = {planos_core.PLANO_PREMIUM, planos_core.PLANO_PRO}

STATUS_AGUARDANDO = "aguardando_pagamento"
STATUS_ATIVA = "ativa"
STATUS_CANCELADA = "cancelada"
STATUS_PENDENTE = "pendente"
STATUS_PAGO = "pago"


class CheckoutPayload(BaseModel):
    plano: str
    metodo: str

    @field_validator("plano")
    @classmethod
    def plano_assinavel(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in PLANOS_ASSINAVEIS:
            raise ValueError("Este plano não pode ser assinado (use premium ou pro).")
        return v

    @field_validator("metodo")
    @classmethod
    def metodo_valido(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in METODOS_VALIDOS:
            raise ValueError("Método de pagamento inválido (use pix ou cartao).")
        return v


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _pagamento_dict(p: Pagamento) -> dict:
    return {
        "id": str(p.id),
        "assinatura_id": str(p.assinatura_id) if p.assinatura_id else None,
        "plano": p.plano,
        "metodo": p.metodo,
        "valor": round(float(p.valor), 2),
        "status": p.status,
        "gateway": p.gateway,
        "gateway_pagamento_id": p.gateway_pagamento_id,
        "qr_code": p.qr_code,
        "qr_base64": p.qr_base64,
        "url_pagamento": p.url_pagamento,
        "expira_em": p.expira_em.isoformat() if p.expira_em else None,
        "criado_em": p.criado_em.isoformat() if p.criado_em else None,
        "pago_em": p.pago_em.isoformat() if p.pago_em else None,
    }


def _assinatura_dict(a: Assinatura) -> dict:
    return {
        "id": str(a.id),
        "plano": a.plano,
        "rotulo": planos_core.get_plano(a.plano).rotulo,
        "status": a.status,
        "gateway": a.gateway,
        "preco_mensal": round(float(a.preco_mensal), 2),
        "data_inicio": a.data_inicio.isoformat() if a.data_inicio else None,
        "data_proxima_cobranca": (
            a.data_proxima_cobranca.isoformat() if a.data_proxima_cobranca else None
        ),
        "cancelada_em": a.cancelada_em.isoformat() if a.cancelada_em else None,
        "criado_em": a.criado_em.isoformat() if a.criado_em else None,
    }


async def _assinatura_ativa(usuario_id: UUID, db) -> Assinatura | None:
    return await db.scalar(
        select(Assinatura).where(
            Assinatura.usuario_id == usuario_id,
            Assinatura.status == STATUS_ATIVA,
        )
    )


async def _confirmar_pagamento(db, pagamento: Pagamento) -> None:
    """Aprova o pagamento e ativa/atualiza a assinatura do usuário."""
    assinatura = (
        await db.get(Assinatura, pagamento.assinatura_id) if pagamento.assinatura_id else None
    )
    if not assinatura:
        raise HTTPException(status_code=404, detail="Assinatura vinculada não encontrada.")

    now = datetime.now(timezone.utc)
    pagamento.status = STATUS_PAGO
    pagamento.pago_em = now

    # Encerra assinaturas ativas concorrentes (ex.: upgrade Premium -> Pro).
    concorrentes = (
        await db.scalars(
            select(Assinatura).where(
                Assinatura.usuario_id == assinatura.usuario_id,
                Assinatura.status == STATUS_ATIVA,
                Assinatura.id != assinatura.id,
            )
        )
    ).all()
    for outra in concorrentes:
        outra.status = STATUS_CANCELADA
        outra.cancelada_em = now

    assinatura.status = STATUS_ATIVA
    assinatura.data_inicio = now
    assinatura.data_proxima_cobranca = now + timedelta(days=30)
    assinatura.cancelada_em = None
    assinatura.gateway_assinatura_id = assinatura.gateway_assinatura_id or pagamento.gateway_pagamento_id

    usuario = await db.get(Usuario, assinatura.usuario_id)
    usuario.plano = planos_core.normalizar_plano(assinatura.plano)

    # Pro / Família: membros ativos acompanham o plano do titular.
    if assinatura.plano == planos_core.PLANO_PRO:
        for linha in await familia_service.membros_ativos(db, assinatura.usuario_id):
            await familia_service.promover_para_pro(db, linha)

    await db.commit()


# ─── Rotas ───────────────────────────────────────────────────────────────────


@router.get("/me")
async def minha_assinatura(usuario_id: CurrentUserID, db: DBSession):
    """Assinatura ativa (se houver) e histórico recente de pagamentos."""
    assinatura = await _assinatura_ativa(usuario_id, db)
    pagamentos = (
        await db.execute(
            select(Pagamento)
            .where(Pagamento.usuario_id == usuario_id)
            .order_by(Pagamento.criado_em.desc())
            .limit(10)
        )
    ).scalars().all()
    return {
        "assinatura": _assinatura_dict(assinatura) if assinatura else None,
        "pagamentos": [_pagamento_dict(p) for p in pagamentos],
    }


@router.post("/checkout", status_code=status.HTTP_201_CREATED)
async def criar_checkout(
    payload: CheckoutPayload, usuario_id: CurrentUserID, db: DBSession
):
    """Cria uma assinatura com pagamento pendente e devolve o que o usuário precisa pagar.

    Em modo ``mock`` retorna ``simulavel=true`` — o frontend pode disparar o
    webhook para simular a aprovação (Ambiente de teste).
    """
    gateway = obter_gateway()
    plano = planos_core.get_plano(payload.plano)
    valor = float(plano.preco_mensal)

    ativa = await _assinatura_ativa(usuario_id, db)
    if ativa:
        if ativa.plano == payload.plano:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Você já assina o plano {plano.rotulo}. Nada a pagar por enquanto.",
            )

    assinatura = Assinatura(
        usuario_id=usuario_id,
        plano=payload.plano,
        status=STATUS_AGUARDANDO,
        gateway=gateway.nome,
        preco_mensal=valor,
    )
    db.add(assinatura)
    await db.flush()

    resultado = gateway.criar_checkout(
        plano_descricao=plano.rotulo,
        valor=valor,
        referencia_usuario=str(usuario_id),
        metodo=payload.metodo,
    )
    pagamento = Pagamento(
        assinatura_id=assinatura.id,
        usuario_id=usuario_id,
        plano=payload.plano,
        metodo=payload.metodo,
        valor=valor,
        status=STATUS_PENDENTE,
        gateway=gateway.nome,
        gateway_pagamento_id=resultado.gateway_referencia,
        qr_code=resultado.qr_code,
        qr_base64=resultado.qr_base64,
        url_pagamento=resultado.url_pagamento,
        expira_em=resultado.expira_em,
    )
    db.add(pagamento)
    await db.commit()
    await db.refresh(pagamento)
    await db.refresh(assinatura)

    return {
        "pagamento": _pagamento_dict(pagamento),
        "assinatura": _assinatura_dict(assinatura),
        "simulavel": gateway.nome == GC_MOCK,
    }


@router.post("/webhook/{gateway}")
async def receber_webhook(
    gateway: str,
    request: Request,
    db: DBSession,
):
    """Callback público do provedor de pagamento (sem autenticação de app).

    O gateway valida a assinatura do payload e devolve um ``WebhookEvento``.
    Em modo mock, o mesmo endpoint é usado para simular a aprovação em dev.
    """
    adaptador = obter_gateway(gateway)
    if adaptador.nome == GC_MOCK and settings.PAYMENT_GATEWAY != GC_MOCK:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Gateway desativado."
        )

    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Payload inválido."
        ) from exc

    evento: WebhookEvento = adaptador.interpretar_webhook(payload, dict(request.headers))

    pagamento = await db.scalar(
        select(Pagamento).where(
            Pagamento.gateway_pagamento_id == evento.gateway_referencia
        )
    )
    if not pagamento:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")

    if not evento.confirmado:
        pagamento.status = "recusado"
        await db.commit()
        return {"status": "recusado"}

    if pagamento.status == STATUS_PAGO:
        return {"status": "ok", "duplicado": True}

    await _confirmar_pagamento(db, pagamento)
    return {"status": "ok"}


@router.post("/cancelar")
async def cancelar_assinatura(usuario_id: CurrentUserID, db: DBSession):
    """Cancela a assinatura ativa e devolve o usuário ao plano gratuito."""
    assinatura = await _assinatura_ativa(usuario_id, db)
    if not assinatura:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você não possui uma assinatura ativa para cancelar.",
        )

    assinatura.status = STATUS_CANCELADA
    assinatura.cancelada_em = datetime.now(timezone.utc)

    usuario = await db.get(Usuario, usuario_id)
    usuario.plano = planos_core.PLANO_GRATUITO
    # Se era Pro / Família, quem foi convidado volta ao plano anterior.
    await familia_service.rebaixar_todos_membros(db, usuario_id)
    await db.commit()

    return {"status": "ok", "assinatura": _assinatura_dict(assinatura)}