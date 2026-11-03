"""
Assinaturas e cobrança — checkout (PIX/cartão), webhook de confirmação e
cancelamento.

O preço SEMPRE vem do catálogo de planos (o cliente nunca manda valor). O
pagamento é confirmado pelo webhook do gateway — em desenvolvimento o gateway
``mock`` permite simular a aprovação, exercitando exatamente o mesmo caminho
que um provedor real (Asaas/Appmax/Stripe) vai usar.
"""
import hmac
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
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
logger = logging.getLogger(__name__)

METODOS_VALIDOS = {METODO_PIX, METODO_CARTAO}
PLANOS_ASSINAVEIS = {planos_core.PLANO_PREMIUM, planos_core.PLANO_PRO}

STATUS_AGUARDANDO = "aguardando_pagamento"
STATUS_ATIVA = "ativa"
STATUS_CANCELADA = "cancelada"
STATUS_PENDENTE = "pendente"
STATUS_PAGO = "pago"

GATEWAY_REVENUECAT = "revenuecat"
# Eventos que mantêm/renovam o acesso. CANCELLATION apenas desliga a renovação
# automática: o acesso continua até expiration_at_ms.
EVENTOS_REVENUECAT_ATIVOS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
    "SUBSCRIPTION_EXTENDED",
    "TEMPORARY_ENTITLEMENT_GRANT",
    "TRANSFER",
}


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


# ─── RevenueCat / App Store ──────────────────────────────────────────────────


def _dt_ms_revenuecat(valor) -> datetime | None:
    """Converte um timestamp em milissegundos da RevenueCat para datetime UTC."""
    if valor in (None, ""):
        return None
    try:
        return datetime.fromtimestamp(int(valor) / 1000, tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _dt_iso_revenuecat(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError:
        return None


def _plano_por_entitlements(entitlement_ids) -> str | None:
    ids = {str(item).strip().lower() for item in (entitlement_ids or [])}
    if settings.REVENUECAT_ENTITLEMENT_PRO.strip().lower() in ids:
        return planos_core.PLANO_PRO
    if settings.REVENUECAT_ENTITLEMENT_PREMIUM.strip().lower() in ids:
        return planos_core.PLANO_PREMIUM
    return None


def _plano_do_evento(evento: dict) -> str | None:
    plano = _plano_por_entitlements(evento.get("entitlement_ids"))
    if plano:
        return plano

    # Fallback para instalações antigas em que a entitlement ainda não foi
    # associada no painel: identifica pelo ID do produto.
    produto = str(evento.get("product_id") or "").lower()
    if "pro" in produto:
        return planos_core.PLANO_PRO
    if "premium" in produto:
        return planos_core.PLANO_PREMIUM
    return None


async def _aplicar_entitlement_revenuecat(
    db,
    usuario_id: UUID,
    plano: str | None,
    expira_em: datetime | None = None,
    inicio_em: datetime | None = None,
    gateway_assinatura_id: str | None = None,
) -> str:
    """Reflete o estado da RevenueCat no usuário e na assinatura local.

    ``plano=None`` encerra o acesso adquirido via App Store. Se houver outra
    assinatura ativa (ex.: comprada na web), o usuário permanece no plano dela.
    """
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    now = datetime.now(timezone.utc)
    plano = planos_core.normalizar_plano(plano) if plano else None
    if plano == planos_core.PLANO_GRATUITO:
        plano = None

    ativas = (
        await db.scalars(
            select(Assinatura).where(
                Assinatura.usuario_id == usuario_id,
                Assinatura.status == STATUS_ATIVA,
            )
        )
    ).all()
    atual = next((a for a in ativas if a.gateway == GATEWAY_REVENUECAT), None)
    plano_anterior = planos_core.normalizar_plano(usuario.plano)

    if plano:
        # Encerra assinaturas concorrentes para o plano refletir a compra atual.
        for outra in ativas:
            if atual and outra.id == atual.id:
                continue
            outra.status = STATUS_CANCELADA
            outra.cancelada_em = now

        if atual is None:
            atual = Assinatura(
                usuario_id=usuario_id,
                plano=plano,
                status=STATUS_ATIVA,
                gateway=GATEWAY_REVENUECAT,
                preco_mensal=float(planos_core.get_plano(plano).preco_mensal),
                data_inicio=inicio_em or now,
            )
            db.add(atual)
        else:
            atual.plano = plano
            atual.status = STATUS_ATIVA
            atual.cancelada_em = None
            atual.data_inicio = atual.data_inicio or inicio_em or now

        atual.gateway_assinatura_id = (
            gateway_assinatura_id or atual.gateway_assinatura_id
        )
        atual.data_proxima_cobranca = expira_em or (now + timedelta(days=30))
        usuario.plano = plano

        if plano == planos_core.PLANO_PRO:
            for linha in await familia_service.membros_ativos(db, usuario_id):
                await familia_service.promover_para_pro(db, linha)
        elif plano_anterior == planos_core.PLANO_PRO:
            await familia_service.rebaixar_todos_membros(db, usuario_id)
    else:
        if atual is not None:
            atual.status = STATUS_CANCELADA
            atual.cancelada_em = now

        # Pode existir uma assinatura ativa comprada fora da App Store.
        restantes = [a for a in ativas if atual is None or a.id != atual.id]
        if restantes:
            melhor = max(
                restantes,
                key=lambda a: (
                    1 if planos_core.normalizar_plano(a.plano) == planos_core.PLANO_PRO else 0
                ),
            )
            usuario.plano = planos_core.normalizar_plano(melhor.plano)
            if usuario.plano == planos_core.PLANO_PRO:
                for linha in await familia_service.membros_ativos(db, usuario_id):
                    await familia_service.promover_para_pro(db, linha)
            else:
                await familia_service.rebaixar_todos_membros(db, usuario_id)
        else:
            usuario.plano = planos_core.PLANO_GRATUITO
            await familia_service.rebaixar_todos_membros(db, usuario_id)

    await db.commit()
    return planos_core.normalizar_plano(usuario.plano)


def _autorizar_webhook_revenuecat(request: Request) -> None:
    esperado = settings.REVENUECAT_WEBHOOK_AUTH.strip()
    if not esperado:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook da RevenueCat não configurado.",
        )
    recebido = request.headers.get("authorization", "")
    if not (
        hmac.compare_digest(recebido, esperado)
        or hmac.compare_digest(recebido, f"Bearer {esperado}")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura do webhook inválida.",
        )


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


@router.post("/iap/sync")
async def sincronizar_assinatura_iap(usuario_id: CurrentUserID, db: DBSession):
    """Sincroniza o plano após uma compra/restauração no iOS.

    O cliente não é confiável para informar o entitlement: consultamos a API
    da RevenueCat com a chave secreta do servidor e aplicamos o estado real.
    """
    if not settings.REVENUECAT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sincronização da App Store não configurada.",
        )

    url = f"{settings.REVENUECAT_API_URL.rstrip('/')}/subscribers/{usuario_id}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resposta = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {settings.REVENUECAT_SECRET_KEY}",
                    "Accept": "application/json",
                },
            )
    except httpx.HTTPError as exc:
        logger.error("Falha ao consultar a RevenueCat: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível consultar a App Store agora. Tente novamente.",
        ) from exc

    if resposta.status_code == 404:
        plano = await _aplicar_entitlement_revenuecat(
            db, usuario_id, None, gateway_assinatura_id=str(usuario_id)
        )
        return {"status": "ok", "plano": plano}

    if resposta.status_code in (401, 403):
        logger.error("RevenueCat recusou a chave secreta configurada.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sincronização da App Store indisponível.",
        )

    try:
        resposta.raise_for_status()
        subscriber = (resposta.json() or {}).get("subscriber") or {}
    except (httpx.HTTPError, ValueError) as exc:
        logger.error("Resposta inválida da RevenueCat: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível consultar a App Store agora. Tente novamente.",
        ) from exc

    now = datetime.now(timezone.utc)
    entitlements = subscriber.get("entitlements") or {}
    ativos: dict[str, datetime | None] = {}
    for nome, info in entitlements.items():
        if not isinstance(info, dict):
            continue
        expira = _dt_iso_revenuecat(info.get("expires_date"))
        if expira is None or expira > now:
            ativos[str(nome).strip().lower()] = expira

    entitlement_pro = settings.REVENUECAT_ENTITLEMENT_PRO.strip().lower()
    entitlement_premium = settings.REVENUECAT_ENTITLEMENT_PREMIUM.strip().lower()
    if entitlement_pro in ativos:
        plano: str | None = planos_core.PLANO_PRO
        expira_plano = ativos[entitlement_pro]
    elif entitlement_premium in ativos:
        plano = planos_core.PLANO_PREMIUM
        expira_plano = ativos[entitlement_premium]
    else:
        plano = None
        expira_plano = None

    plano_aplicado = await _aplicar_entitlement_revenuecat(
        db,
        usuario_id,
        plano,
        expira_em=expira_plano,
        gateway_assinatura_id=str(usuario_id),
    )
    return {"status": "ok", "plano": plano_aplicado}


@router.post("/webhook/revenuecat")
async def webhook_revenuecat(request: Request, db: DBSession):
    """Webhook da RevenueCat — fonte da verdade para compras na App Store."""
    _autorizar_webhook_revenuecat(request)

    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Payload inválido."
        ) from exc

    evento = payload.get("event") if isinstance(payload, dict) else None
    if not isinstance(evento, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Evento ausente."
        )

    tipo = str(evento.get("type") or "").upper()
    app_user_id = evento.get("app_user_id") or evento.get("original_app_user_id")
    try:
        usuario_id = UUID(str(app_user_id))
    except (TypeError, ValueError):
        # Compra anônima ou de outro app: nada a fazer, mas confirma o recebimento.
        logger.warning("Webhook RevenueCat sem app_user_id UUID: %s", app_user_id)
        return {"status": "ignored", "motivo": "app_user_id inválido"}

    # Cancelamento desliga apenas a renovação automática; o acesso permanece
    # até a data de expiração (evento EXPIRATION).
    if tipo in {"CANCELLATION", "BILLING_ISSUE"}:
        return {"status": "ok", "acesso_mantido": True}

    now = datetime.now(timezone.utc)
    expira_em = _dt_ms_revenuecat(evento.get("expiration_at_ms"))
    inicio_em = _dt_ms_revenuecat(
        evento.get("purchase_at_ms") or evento.get("original_purchase_at_ms")
    )

    plano: str | None = None
    if tipo in EVENTOS_REVENUECAT_ATIVOS:
        if expira_em is None or expira_em > now:
            plano = _plano_do_evento(evento)
    elif tipo == "EXPIRATION":
        plano = None
    else:
        # Eventos novos/desconhecidos: aplica somente se houver entitlement ativa.
        candidato = _plano_do_evento(evento)
        if candidato and (expira_em is None or expira_em > now):
            plano = candidato

    plano_aplicado = await _aplicar_entitlement_revenuecat(
        db,
        usuario_id,
        plano,
        expira_em=expira_em,
        inicio_em=inicio_em,
        gateway_assinatura_id=str(app_user_id),
    )
    return {"status": "ok", "plano": plano_aplicado}


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