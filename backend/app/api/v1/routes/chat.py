"""
Chat IA — Assistente financeiro conversacional.
Entende perguntas em linguagem natural sobre a situação financeira do usuário.
"""
import logging
from datetime import date, timedelta
from typing import Any
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.config import settings
from app.core.dependencies import CurrentUserID, DBSession
from app.core.rastro_client import rastro_client
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida
from app.models.renda import Renda

router = APIRouter(prefix="/chat", tags=["Chat IA"])
logger = logging.getLogger(__name__)

MAX_HISTORICO = 20  # máximo de mensagens no contexto
MAX_MENSAGEM_CHARS = 2000
MAX_MESSAGES_REQUEST = 50


class Mensagem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MENSAGEM_CHARS)


class ChatRequest(BaseModel):
    messages: list[Mensagem] = Field(min_length=1, max_length=MAX_MESSAGES_REQUEST)


class ChatResponse(BaseModel):
    reply: str


# ─── Monta contexto financeiro do usuário ────────────────────────────────────

async def _contexto_financeiro(usuario_id: Any, db: Any) -> str:
    hoje = date.today()
    proximo_mes = hoje + timedelta(days=30)

    # Rendas
    rendas_r = await db.execute(
        select(Renda).where(Renda.usuario_id == usuario_id, Renda.ativo == True)  # noqa: E712
    )
    rendas = rendas_r.scalars().all()
    renda_total = sum(float(r.valor) for r in rendas)

    # Dívidas ativas
    dividas_r = await db.execute(
        select(Divida).where(Divida.usuario_id == usuario_id, Divida.quitada == False)  # noqa: E712
    )
    dividas = dividas_r.scalars().all()
    total_dividas = sum(float(d.valor_total) for d in dividas)

    # Contas a pagar nos próximos 30 dias
    pagar_r = await db.execute(
        select(ContaAPagar).where(
            ContaAPagar.usuario_id == usuario_id,
            ContaAPagar.status == "pendente",
            ContaAPagar.data_vencimento >= hoje,
            ContaAPagar.data_vencimento <= proximo_mes,
        ).order_by(ContaAPagar.data_vencimento)
    )
    contas_pagar = pagar_r.scalars().all()
    total_a_pagar = sum(float(c.valor) for c in contas_pagar)

    # Contas a receber nos próximos 30 dias
    receber_r = await db.execute(
        select(ContaAReceber).where(
            ContaAReceber.usuario_id == usuario_id,
            ContaAReceber.status == "pendente",
            ContaAReceber.data_prevista >= hoje,
            ContaAReceber.data_prevista <= proximo_mes,
        ).order_by(ContaAReceber.data_prevista)
    )
    contas_receber = receber_r.scalars().all()
    total_a_receber = sum(float(c.valor) for c in contas_receber)

    def brl(v: float) -> str:
        return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    linhas = [
        f"Data de hoje: {hoje.strftime('%d/%m/%Y')}",
        f"Renda mensal total: {brl(renda_total)}",
        f"Fontes de renda: {', '.join(r.descricao for r in rendas) or 'nenhuma'}",
        "",
        f"Dívidas ativas ({len(dividas)} dívidas, total {brl(total_dividas)}):",
    ]
    for d in dividas:
        parc = f"{d.parcelas_restantes}/{d.parcelas_totais}" if d.parcelas_totais else "?"
        linhas.append(f"  - {d.descricao} ({d.credor}): {brl(float(d.valor_total))}, "
                      f"parcela {brl(float(d.valor_parcela))}, restantes {parc}, "
                      f"juros {d.taxa_juros_mensal or 0}%/mês")

    linhas += [
        "",
        f"Contas a PAGAR nos próximos 30 dias: {brl(total_a_pagar)} ({len(contas_pagar)} contas)",
    ]
    for c in contas_pagar[:5]:
        linhas.append(f"  - {c.descricao}: {brl(float(c.valor))} — vence {c.data_vencimento.strftime('%d/%m/%Y')}")

    linhas += [
        "",
        f"Contas a RECEBER nos próximos 30 dias: {brl(total_a_receber)} ({len(contas_receber)} contas)",
    ]
    for c in contas_receber[:5]:
        linhas.append(f"  - {c.descricao}: {brl(float(c.valor))} — prevista {c.data_prevista.strftime('%d/%m/%Y')}")

    linhas.append(f"\nSaldo projetado 30 dias: {brl(renda_total + total_a_receber - total_a_pagar)}")

    return "\n".join(linhas)


SYSTEM_PROMPT = """\
Você é o assistente financeiro do Equili, um app de controle financeiro familiar.
Seu nome é "Equili" e você é empático, direto e especialista em finanças pessoais brasileiras.

REGRAS:
- Responda sempre em português brasileiro, de forma clara e acessível.
- Nunca julgue a situação financeira do usuário. Seja encorajador.
- Use os dados financeiros fornecidos no contexto para responder com precisão.
- Se não souber algo que não está no contexto, diga claramente.
- Nunca invente valores que não estão no contexto.
- Mantenha respostas concisas (máximo 3 parágrafos) a menos que seja pedido algo detalhado.
- Para resumos e comparações, use listas bullet quando ajudar a clareza.
- Não use markdown complexo — o chat renderiza texto simples.

CONTEXTO FINANCEIRO DO USUÁRIO (atualizado agora):
{contexto}
"""


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    if not settings.GITHUB_TOKEN:
        await rastro_client.send_warning_event(
            message="Endpoint de chat IA chamado sem GITHUB_TOKEN configurado.",
            fingerprint="equili:chat:config:missing_github_token",
        )
        raise HTTPException(status_code=503, detail="Assistente IA não configurado.")

    if not body.messages:
        raise HTTPException(status_code=422, detail="Envie ao menos uma mensagem.")

    # Limita o histórico para não exceder o contexto do modelo
    messages = body.messages[-MAX_HISTORICO:]
    if len(body.messages) > MAX_HISTORICO:
        await rastro_client.send_warning_event(
            message="Histórico do chat truncado para caber no contexto do modelo.",
            fingerprint="equili:chat:history:truncated",
        )

    # Monta o contexto financeiro fresco a cada chamada
    contexto = await _contexto_financeiro(usuario_id, db)
    system = SYSTEM_PROMPT.format(contexto=contexto)

    payload = {
        "model": settings.GITHUB_MODELS_MODEL,
        "messages": [
            {"role": "system", "content": system},
            *[{"role": m.role, "content": m.content} for m in messages],
        ],
        "temperature": 0.7,
        "max_tokens": 600,
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
            data = resp.json()
            reply = data["choices"][0]["message"]["content"].strip()
            return ChatResponse(reply=reply)

    except httpx.HTTPStatusError as exc:
        logger.error(f"[chat] HTTP error: {exc.response.status_code} — {exc.response.text}")
        await rastro_client.send_warning_event(
            message=f"Falha HTTP no provedor de IA do chat: status {exc.response.status_code}.",
            fingerprint=f"equili:chat:provider:http_status:{exc.response.status_code}",
        )
        raise HTTPException(status_code=502, detail="Erro ao contatar a IA. Tente novamente.")
    except Exception as exc:
        logger.error(f"[chat] Erro inesperado: {exc}")
        await rastro_client.send_error_event(
            message=f"Erro inesperado no endpoint de chat: {exc}",
            fingerprint="equili:chat:unexpected_error",
        )
        raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")
