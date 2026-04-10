"""
WhatsApp bot via Evolution API.

Fluxo:
  1. Evolution API recebe mensagem no WhatsApp e chama POST /whatsapp/webhook
  2. Localizamos o usuário pelo número de telefone
  3. Chamamos o mesmo LLM do Chat IA com contexto financeiro
  4. Enviamos a resposta de volta via Evolution API REST
"""
import logging
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status

from app.core.config import settings
from app.core.dependencies import DBSession
from app.api.v1.routes.chat import _contexto_financeiro, SYSTEM_PROMPT, MAX_HISTORICO
from app.db.session import AsyncSessionLocal
from app.models.usuario import Usuario
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Bot"])

# Histórico em memória por número (chave = remoteJid, valor = lista de mensagens)
# Suficiente para conversas curtas; não persiste entre reinicializações
_historico: dict[str, list[dict]] = {}


# ─── Helpers Evolution API ────────────────────────────────────────────────────

def _evo_headers() -> dict:
    return {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}


async def _enviar_mensagem(numero: str, texto: str) -> None:
    """Envia texto para um número via Evolution API."""
    if not settings.EVOLUTION_API_URL or not settings.EVOLUTION_API_KEY:
        logger.warning("[whatsapp] Evolution API não configurada — mensagem não enviada.")
        return
    url = f"{settings.EVOLUTION_API_URL}/message/sendText/{settings.EVOLUTION_INSTANCE}"
    payload = {"number": numero, "text": texto}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, headers=_evo_headers(), json=payload)
            resp.raise_for_status()
    except Exception as exc:
        logger.error(f"[whatsapp] Falha ao enviar mensagem para {numero}: {exc}")


# ─── Lógica principal (roda em background) ───────────────────────────────────

async def _processar_mensagem(numero: str, texto: str) -> None:
    """Busca usuário, monta contexto e responde via LLM."""
    # Normaliza número: remove @s.whatsapp.net, mantém só dígitos + país
    numero_limpo = numero.split("@")[0]

    async with AsyncSessionLocal() as db:
        # Busca usuário pelo telefone (campo `telefone` no model Usuario)
        result = await db.execute(
            select(Usuario).where(Usuario.telefone == numero_limpo)
        )
        usuario = result.scalar_one_or_none()

        if usuario is None:
            await _enviar_mensagem(
                numero_limpo,
                "Olá! Para usar o assistente financeiro do Equili pelo WhatsApp, "
                "primeiro cadastre seu número de telefone no aplicativo em equili.com.br 📱",
            )
            return

        if not settings.GITHUB_TOKEN:
            await _enviar_mensagem(numero_limpo, "Assistente IA temporariamente indisponível. Tente pelo app.")
            return

        # Gerencia histórico
        hist = _historico.setdefault(numero_limpo, [])
        hist.append({"role": "user", "content": texto})
        # Limita histórico
        if len(hist) > MAX_HISTORICO:
            hist[:] = hist[-MAX_HISTORICO:]

        # Monta contexto financeiro
        contexto = await _contexto_financeiro(usuario.id, db)
        system = SYSTEM_PROMPT.format(contexto=contexto)

        payload = {
            "model": settings.GITHUB_MODELS_MODEL,
            "messages": [{"role": "system", "content": system}, *hist],
            "temperature": 0.7,
            "max_tokens": 400,  # menor que no app — cabe bem no WhatsApp
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{settings.GITHUB_MODELS_ENDPOINT}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                reply = resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            logger.error(f"[whatsapp] Erro LLM: {exc}")
            reply = "Desculpe, não consegui processar sua pergunta agora. Tente novamente em instantes."

        hist.append({"role": "assistant", "content": reply})
        await _enviar_mensagem(numero_limpo, reply)


# ─── Endpoint webhook ─────────────────────────────────────────────────────────

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Recebe eventos da Evolution API.
    Configure o webhook na Evolution API apontando para:
      https://equili.com.br/api/v1/whatsapp/webhook
    """
    # Validação opcional do secret
    if settings.WHATSAPP_WEBHOOK_SECRET:
        token = request.headers.get("x-webhook-secret", "")
        if token != settings.WHATSAPP_WEBHOOK_SECRET:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token inválido")

    body: dict[str, Any] = await request.json()

    # Estrutura do evento da Evolution API v2
    event = body.get("event", "")
    data = body.get("data", {})

    # Só processar mensagens recebidas (não enviadas pelo bot)
    if event != "messages.upsert":
        return {"ok": True}

    message = data.get("message", {})
    key = data.get("key", {})

    # Ignorar mensagens enviadas pelo próprio número (fromMe=True)
    if key.get("fromMe", False):
        return {"ok": True}

    remote_jid: str = key.get("remoteJid", "")
    # Ignorar grupos
    if "@g.us" in remote_jid:
        return {"ok": True}

    # Extrai texto da mensagem (texto simples ou legenda de mídia)
    texto = (
        message.get("conversation")
        or message.get("extendedTextMessage", {}).get("text")
        or message.get("imageMessage", {}).get("caption")
        or ""
    ).strip()

    if not texto:
        return {"ok": True}

    # Processa em background para não bloquear o webhook
    background_tasks.add_task(_processar_mensagem, remote_jid, texto)
    return {"ok": True}
