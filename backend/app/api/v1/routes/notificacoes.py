"""
Rotas de notificações push (Web Push / VAPID).
"""
import base64
import json
import tempfile
import os
from datetime import datetime, date, timedelta

from fastapi import APIRouter, HTTPException, status
from pydantic import AnyHttpUrl, BaseModel, Field
from sqlalchemy import select, delete

from app.core.config import settings
from app.core.dependencies import CurrentUserID, DBSession
from app.models.push_subscription import PushSubscription

router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class SubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=20, max_length=512)
    auth: str = Field(min_length=10, max_length=256)


class SubscriptionPayload(BaseModel):
    endpoint: AnyHttpUrl
    keys: SubscriptionKeys


class SubscribeRequest(BaseModel):
    subscription: SubscriptionPayload


class UnsubscribeRequest(BaseModel):
    endpoint: AnyHttpUrl


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _get_vapid_private_pem() -> str:
    """Decodifica a chave PEM armazenada em base64 no .env."""
    return base64.b64decode(settings.VAPID_PRIVATE_KEY_B64).decode()


def _send_push(subscription_info: dict, payload: dict) -> None:
    """Envia uma notificação push usando pywebpush."""
    try:
        from pywebpush import webpush, WebPushException

        pem = _get_vapid_private_pem()
        # Escreve PEM em arquivo temporário (pywebpush exige arquivo)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pem", mode="w") as f:
            f.write(pem)
            pem_path = f.name

        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=pem_path,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
        finally:
            os.unlink(pem_path)
    except Exception as exc:
        # Não levanta — falhas de push não devem derrubar o endpoint
        print(f"[push] Erro ao enviar notificação: {exc}")


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Retorna a VAPID public key para o frontend usar na subscrição."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push não configurado neste servidor")
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    body: SubscribeRequest,
    db: DBSession,
    user_id: CurrentUserID,
):
    """Salva a subscrição push do dispositivo do usuário."""
    endpoint = str(body.subscription.endpoint)
    p256dh = body.subscription.keys.p256dh
    auth = body.subscription.keys.auth

    # Upsert: atualiza se endpoint já existe
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Um endpoint push já registrado por outro usuário não pode ser reatribuído.
        if existing.usuario_id != user_id:
            raise HTTPException(
                status_code=409,
                detail="Este dispositivo já está registrado em outra conta.",
            )
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        db.add(PushSubscription(
            usuario_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
        ))

    await db.commit()


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    body: UnsubscribeRequest,
    db: DBSession,
    user_id: CurrentUserID,
):
    """Remove a subscrição push do dispositivo."""
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == str(body.endpoint),
            PushSubscription.usuario_id == user_id,
        )
    )
    await db.commit()


@router.post("/teste", status_code=status.HTTP_204_NO_CONTENT)
async def testar_notificacao(
    db: DBSession,
    user_id: CurrentUserID,
):
    """Envia uma notificação de teste para todos os dispositivos do usuário."""
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.usuario_id == user_id)
    )
    subs = result.scalars().all()
    payload = {
        "title": "Equili 🎉",
        "body": "Notificações ativadas com sucesso! Você receberá alertas de vencimento.",
        "icon": "/icons/icon-192x192.png",
        "url": "/dashboard",
    }
    for sub in subs:
        _send_push(
            {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            payload,
        )
