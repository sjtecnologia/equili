"""
Serviço de alertas automáticos via push notification.
Roda diariamente às 08:00 e verifica contas a vencer em 1 e 3 dias.
"""
import asyncio
import json
import logging
import os
import tempfile
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rastro_client import rastro_client
from app.db.session import AsyncSessionLocal
from app.models.conta_lancamento import ContaAPagar
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


def _emit_warning_async(message: str, fingerprint: str) -> None:
    """Dispara warning para observabilidade sem bloquear o job agendado."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            rastro_client.send_warning_event(
                message=message,
                fingerprint=fingerprint,
            )
        )
    except RuntimeError:
        logger.debug("[alertas] sem loop ativo para enviar warning ao Rastro")


def _send_push_sync(subscription_info: dict, payload: dict) -> None:
    try:
        from pywebpush import webpush

        pem = __import__('base64').b64decode(settings.VAPID_PRIVATE_KEY_B64).decode()
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
        logger.warning(f"[alertas] Falha ao enviar push: {exc}")
        _emit_warning_async(
            message=f"Falha ao enviar push notification no job de alertas: {exc}",
            fingerprint="equili:alertas:push_send_failed",
        )


async def verificar_vencimentos() -> None:
    """Verifica contas a vencer hoje, em 1 dia e em 3 dias e envia alertas."""
    if not settings.VAPID_PRIVATE_KEY_B64:
        return

    hoje = date.today()
    contas_vencendo_hoje = 0
    contas_sem_subscription = 0
    datas_alerta = {
        0: "vence HOJE",
        1: "vence amanhã",
        3: "vence em 3 dias",
    }

    async with AsyncSessionLocal() as db:
        for offset, label in datas_alerta.items():
            alvo = hoje + timedelta(days=offset)

            # Busca contas a pagar pendentes com vencimento na data alvo
            result = await db.execute(
                select(ContaAPagar).where(
                    ContaAPagar.data_vencimento == alvo,
                    ContaAPagar.status == "pendente",
                )
            )
            contas = result.scalars().all()
            if offset == 0:
                contas_vencendo_hoje = len(contas)

            for conta in contas:
                # Busca subscriptions do dono da conta
                subs_result = await db.execute(
                    select(PushSubscription).where(
                        PushSubscription.usuario_id == conta.usuario_id
                    )
                )
                subscriptions = subs_result.scalars().all()
                if not subscriptions:
                    contas_sem_subscription += 1

                valor = f"R$ {conta.valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                payload = {
                    "title": f"💸 Conta a pagar: {conta.descricao}",
                    "body": f"{valor} — {label.capitalize()}",
                    "icon": "/icons/icon-192x192.png",
                    "badge": "/icons/icon-72x72.png",
                    "url": "/contas-pagar",
                    "tag": f"conta-{conta.id}",
                }

                for sub in subscriptions:
                    _send_push_sync(
                        {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                        payload,
                    )

    if contas_vencendo_hoje > 0 and contas_sem_subscription > 0:
        await rastro_client.send_warning_event(
            message=(
                "Contas vencendo hoje sem canal de push disponível: "
                f"{contas_sem_subscription} de {contas_vencendo_hoje}."
            ),
            fingerprint="equili:alertas:coverage:missing_push_subscription",
        )

    logger.info("[alertas] Verificação de vencimentos concluída")


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")
    # Roda todo dia às 08:00 no horário de Brasília
    scheduler.add_job(verificar_vencimentos, "cron", hour=8, minute=0, id="alertas_vencimento")
    scheduler.start()
    logger.info("[scheduler] Agendador de alertas iniciado (08:00 diário)")
    return scheduler
