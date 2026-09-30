import json
import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import extract, func, select

from app.core.config import settings
from app.core.dependencies import CurrentUserID, DBSession
from app.core.rastro_client import rastro_client
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida
from app.models.plano_acao import PlanoAcao
from app.models.renda import Renda
from app.services.github_models import GitHubModelsNotConfigured, chamar_github_models_com_uso

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
Você é um consultor financeiro empático e especialista em finanças pessoais brasileiras.
Seu papel é analisar a situação financeira de uma família e criar um plano de ação
CLARO, MOTIVADOR e REALISTA para quitação de dívidas.

Regras:
- Nunca julgue a situação. Seja encorajador e positivo.
- Use linguagem simples, acessível, sem jargões financeiros excessivos.
- Responda SEMPRE em JSON válido conforme o schema abaixo.
- Seja específico com datas e valores.
- Priorize pelo método avalanche (maior juros primeiro) por padrão.
- Leve em conta o fluxo de caixa real dos próximos 30 dias ao calcular o valor disponível para dívidas.
- Se houver alerta de fluxo de caixa (ex: contas vencendo antes de recebimentos), mencione em alerta_fluxo_caixa.

Schema de resposta (JSON puro, sem markdown):
{
  "resumo_situacao": "string (2-3 frases empáticas)",
  "estrategia": "avalanche",
  "justificativa_estrategia": "string",
  "valor_mensal_para_dividas": 0.0,
  "saldo_disponivel_real": 0.0,
  "ordem_quitacao": [
    {
      "ordem": 1,
      "descricao": "string",
      "data_quitacao_estimada": "YYYY-MM",
      "motivo_prioridade": "string"
    }
  ],
  "data_livre_prevista": "YYYY-MM",
  "meses_ate_liberdade": 0,
  "sugestoes_economia": ["string", "string", "string"],
  "mensagem_motivacional": "string",
  "alerta_fluxo_caixa": "string ou null (alerta sobre contas próximas vs. recebimentos)"
}
"""


async def _verificar_cota_ia(usuario_id: UUID, db) -> None:
    from app.models.usuario import Usuario
    usuario = await db.get(Usuario, usuario_id)
    if usuario and usuario.plano == "gratuito":
        now = datetime.now(timezone.utc)
        count = await db.scalar(
            select(func.count()).where(
                PlanoAcao.usuario_id == usuario_id,
                extract("month", PlanoAcao.criado_em) == now.month,
                extract("year", PlanoAcao.criado_em) == now.year,
            )
        )
        if count >= settings.PLANO_GRATIS_MAX_PLANOS_IA_MES:
            await rastro_client.send_warning_event(
                message="Usuário excedeu cota mensal de geração de plano IA no plano gratuito.",
                fingerprint="equili:plano_acao:quota:limit_exceeded",
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Você atingiu o limite de {settings.PLANO_GRATIS_MAX_PLANOS_IA_MES} planos por mês no plano gratuito.",
            )


@router.post("/gerar", status_code=status.HTTP_201_CREATED)
async def gerar_plano(usuario_id: CurrentUserID, db: DBSession):
    await _verificar_cota_ia(usuario_id, db)

    # Coletar rendas
    rendas_result = await db.execute(
        select(Renda).where(Renda.usuario_id == usuario_id, Renda.ativo == True)  # noqa: E712
    )
    rendas = rendas_result.scalars().all()

    if not rendas:
        await rastro_client.send_warning_event(
            message="Tentativa de gerar plano de ação sem renda cadastrada.",
            fingerprint="equili:plano_acao:business:no_income_registered",
        )
        raise HTTPException(status_code=400, detail="Cadastre ao menos uma renda antes de gerar o plano.")

    # Coletar dívidas ativas
    dividas_result = await db.execute(
        select(Divida).where(Divida.usuario_id == usuario_id, Divida.quitada == False)  # noqa: E712
    )
    dividas = dividas_result.scalars().all()

    renda_total = sum(float(r.valor) for r in rendas)
    total_dividas = sum(float(d.valor_total) for d in dividas)

    # Todas as contas pendentes (sem limite de data)
    hoje = date.today()
    em_30_dias = hoje + timedelta(days=30)
    contas_pagar_result = await db.execute(
        select(ContaAPagar)
        .where(
            ContaAPagar.usuario_id == usuario_id,
            ContaAPagar.status != "pago",
        )
        .order_by(ContaAPagar.data_vencimento)
    )
    contas_pagar = contas_pagar_result.scalars().all()

    # Todas as contas a receber pendentes
    contas_receber_result = await db.execute(
        select(ContaAReceber)
        .where(
            ContaAReceber.usuario_id == usuario_id,
            ContaAReceber.status != "recebido",
        )
        .order_by(ContaAReceber.data_prevista)
    )
    contas_receber = contas_receber_result.scalars().all()

    # Saldo dos próximos 30 dias (janela imediata de caixa)
    pagar_30d = [c for c in contas_pagar if c.data_vencimento <= em_30_dias]
    receber_30d = [c for c in contas_receber if c.data_prevista <= em_30_dias]
    total_a_pagar_30d = sum(float(c.valor) for c in pagar_30d)
    total_a_receber_30d = sum(float(c.valor) for c in receber_30d)
    total_a_pagar_total = sum(float(c.valor) for c in contas_pagar)
    total_a_receber_total = sum(float(c.valor) for c in contas_receber)
    saldo_disponivel_real = renda_total + total_a_receber_30d - total_a_pagar_30d
    if saldo_disponivel_real < 0:
        await rastro_client.send_warning_event(
            message=(
                f"Fluxo de caixa projetado negativo em 30 dias para geração de plano: "
                f"saldo={saldo_disponivel_real:.2f}"
            ),
            fingerprint="equili:plano_acao:cashflow:negative_30d",
        )

    rendas_texto = "\n".join(
        f"- {r.descricao} ({r.tipo}): R$ {float(r.valor):,.2f}/{r.frequencia}" for r in rendas
    )
    dividas_texto = "\n".join(
        f"- {d.descricao} | Credor: {d.credor or 'N/A'} | Tipo: {d.tipo} | "
        f"Total: R$ {float(d.valor_total):,.2f} | Parcela: R$ {float(d.valor_parcela):,.2f} | "
        f"Parcelas restantes: {d.parcelas_restantes} | "
        f"Juros: {float(d.taxa_juros_mensal)*100:.2f}%/mês" if d.taxa_juros_mensal else
        f"- {d.descricao} | Credor: {d.credor or 'N/A'} | Tipo: {d.tipo} | "
        f"Total: R$ {float(d.valor_total):,.2f} | Parcela: R$ {float(d.valor_parcela):,.2f} | "
        f"Parcelas restantes: {d.parcelas_restantes} | Sem juros informados"
        for d in dividas
    )
    contas_pagar_texto = "\n".join(
        f"- {c.descricao} ({c.categoria}) | Vence: {c.data_vencimento.strftime('%d/%m/%Y')} | "
        f"R$ {float(c.valor):,.2f} | Status: {c.status}"
        for c in contas_pagar
    ) or "Nenhuma conta a pagar pendente."
    contas_receber_texto = "\n".join(
        f"- {c.descricao} ({c.origem}) | Previsto: {c.data_prevista.strftime('%d/%m/%Y')} | "
        f"R$ {float(c.valor):,.2f}" + (f" | De: {c.devedor}" if c.devedor else "")
        for c in contas_receber
    ) or "Nenhuma conta a receber pendente."

    user_prompt = f"""
Situação financeira da família:

RENDA MENSAL RECORRENTE: R$ {renda_total:,.2f}

FONTES DE RENDA:
{rendas_texto}

{f'TOTAL DE DÍVIDAS: R$ {total_dividas:,.2f}' if dividas else 'SEM DÍVIDAS CADASTRADAS'}

{f'DÍVIDAS ATIVAS:\n{dividas_texto}' if dividas else ''}

FLUXO DE CAIXA — PRÓXIMOS 30 DIAS:
  Total a PAGAR: R$ {total_a_pagar_30d:,.2f}
  Total a RECEBER: R$ {total_a_receber_30d:,.2f}
  SALDO DISPONÍVEL REAL (renda + receber - pagar): R$ {saldo_disponivel_real:,.2f}

TOTAL GERAL PENDENTE:
  Total a PAGAR (todos os meses): R$ {total_a_pagar_total:,.2f}
  Total a RECEBER (todos os meses): R$ {total_a_receber_total:,.2f}
  SALDO LÍQUIDO FUTURO: R$ {total_a_receber_total - total_a_pagar_total:,.2f}

TODAS AS CONTAS A PAGAR PENDENTES:
{contas_pagar_texto}

TODAS AS CONTAS A RECEBER PENDENTES:
{contas_receber_texto}

Data atual: {hoje.strftime("%d/%m/%Y")}

{"Crie o plano de ação para esta família sair das dívidas, levando em conta o fluxo de caixa real." if dividas else "Esta família não tem dívidas mas possui contas a pagar pendentes. Crie um plano de ação financeiro para organizar o fluxo de caixa, garantir o pagamento em dia e começar a poupar."}
"""

    try:
        conteudo_texto, tokens_usados = await chamar_github_models_com_uso(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
    except GitHubModelsNotConfigured:
        await rastro_client.send_warning_event(
            message="Serviço de plano de ação chamado sem GITHUB_MODELS_API_KEY configurado.",
            fingerprint="equili:plano_acao:config:missing_github_token",
        )
        raise HTTPException(status_code=503, detail="Serviço de IA não configurado. Verifique o GITHUB_MODELS_API_KEY.")
    except TimeoutError:
        await rastro_client.send_warning_event(
            message="Timeout ao chamar provedor de IA do plano de ação.",
            fingerprint="equili:plano_acao:provider:timeout",
        )
        raise HTTPException(status_code=503, detail="O serviço de IA demorou muito para responder. Tente novamente.")
    except httpx.HTTPStatusError as e:
        logger.error("Erro na API LLM: status %s", e.response.status_code)
        await rastro_client.send_warning_event(
            message=f"Falha HTTP no provedor de IA do plano de ação: status {e.response.status_code}.",
            fingerprint=f"equili:plano_acao:provider:http_status:{e.response.status_code}",
        )
        raise HTTPException(status_code=503, detail="Serviço de IA indisponível no momento.")
    except ValueError:
        await rastro_client.send_warning_event(
            message="Resposta não-JSON recebida do provedor de IA no plano de ação.",
            fingerprint="equili:plano_acao:provider:invalid_json",
        )
        raise HTTPException(status_code=503, detail="Resposta inválida do serviço de IA.")

    try:
        conteudo_json = json.loads(conteudo_texto)
    except json.JSONDecodeError:
        await rastro_client.send_warning_event(
            message="Resposta não-JSON recebida do provedor de IA no plano de ação.",
            fingerprint="equili:plano_acao:provider:invalid_json",
        )
        raise HTTPException(status_code=503, detail="Resposta inválida do serviço de IA.")

    data_livre_str = conteudo_json.get("data_livre_prevista")
    data_livre = None
    if data_livre_str:
        try:
            data_livre = date.fromisoformat(f"{data_livre_str}-01")
        except ValueError:
            pass

    plano = PlanoAcao(
        usuario_id=usuario_id,
        conteudo=conteudo_json,
        conteudo_texto=conteudo_texto,
        estrategia=conteudo_json.get("estrategia"),
        data_livre_prevista=data_livre,
        tokens_usados=tokens_usados,
    )
    db.add(plano)
    await db.commit()
    await db.refresh(plano)
    return plano


@router.get("/atual")
async def plano_atual(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(PlanoAcao)
        .where(PlanoAcao.usuario_id == usuario_id)
        .order_by(PlanoAcao.criado_em.desc())
        .limit(1)
    )
    plano = result.scalar_one_or_none()
    if not plano:
        raise HTTPException(status_code=404, detail="Nenhum plano gerado ainda.")
    return plano


@router.get("/historico")
async def historico_planos(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(PlanoAcao)
        .where(PlanoAcao.usuario_id == usuario_id)
        .order_by(PlanoAcao.criado_em.desc())
        .limit(3)
    )
    return result.scalars().all()


class FeedbackRequest(BaseModel):
    feedback: Literal[1, -1]
    feedback_texto: str | None = Field(default=None, max_length=500)


@router.post("/{plano_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def enviar_feedback(plano_id: UUID, data: FeedbackRequest, usuario_id: CurrentUserID, db: DBSession):
    plano = await db.get(PlanoAcao, plano_id)
    if not plano or plano.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")

    # Validation is now handled by the FeedbackRequest model

    plano.feedback = data.feedback
    plano.feedback_texto = data.feedback_texto
    await db.commit()
