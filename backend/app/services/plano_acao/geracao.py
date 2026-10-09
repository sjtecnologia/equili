"""Prompt, chamada à IA e parse robusto do Plano de Ação."""
from __future__ import annotations

import json
import logging
import re
from datetime import date

from app.services.openrouter import chamar_openrouter_com_uso

logger = logging.getLogger(__name__)

TIMEOUT_IA_SEGUNDOS = 60.0
MAX_TENTATIVAS_PARSE = 2  # 1 chamada + 1 retry
MAX_TOKENS = 1500
TEMPERATURE = 0.3

SYSTEM_PROMPT = """Você é um consultor financeiro empático e especialista em finanças pessoais brasileiras.
Sua tarefa é montar um plano de ação CLARO, REALISTA e encorajador, com foco em desendividamento quando houver dívidas.
Use apenas os números do resumo fornecido; não invente valores. Priorize o método avalanche (maior juros primeiro).

FORMATO DE SAÍDA (obrigatório): responda SOMENTE com um objeto JSON válido, sem markdown, sem comentários e sem nenhum texto fora do JSON, exatamente neste schema:
{
  "resumo_situacao": "string curta da situação",
  "prioridades": ["string"],
  "plano": [{"acao": "string", "valor_estimado": "string ou null", "prazo": "string", "prioridade": "alta|media|baixa"}],
  "projecao": "string com projeção de caixa nos próximos meses"
}"""

USER_TEMPLATE = """RESUMO FINANCEIRO (JSON compacto, valores em R$):
{resumo_json}

SITUAÇÃO: {situacao}

Data atual: {data}.
Gere o plano de ação. Responda SOMENTE com o JSON do schema indicado, sem markdown e sem texto fora do JSON."""


class PlanoIAError(Exception):
    """Falha ao obter um plano válido da IA (mensagem já amigável)."""


def montar_prompt(resumo: dict, hoje: date | None = None) -> tuple[str, str]:
    hoje = hoje or date.today()
    endividado = bool(resumo.get("dividas")) or resumo.get("a_pagar_pendente", {}).get("vencido", 0) > 0
    if resumo.get("dividas"):
        situacao = "o usuário está ENDIVIDADO; foque o plano em quitar as dívidas listadas sem comprometer o caixa."
    elif endividado:
        situacao = "sem dívidas cadastradas, mas há contas vencidas; foque em regularizar o caixa."
    else:
        situacao = "sem dívidas; foque em organizar o fluxo de caixa e começar a poupar."
    resumo_json = json.dumps(resumo, ensure_ascii=False, separators=(",", ":"))
    return SYSTEM_PROMPT, USER_TEMPLATE.format(resumo_json=resumo_json, situacao=situacao, data=hoje.strftime("%d/%m/%Y"))


def extrair_json(texto: str) -> dict | None:
    """json.loads direto; se falhar, tenta o primeiro bloco {...} do texto."""
    candidatos = [texto.strip()]
    achado = re.search(r"\{.*\}", texto, re.DOTALL)
    if achado:
        candidatos.append(achado.group(0))
    for c in candidatos:
        try:
            obj = json.loads(c)
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(obj, dict) and obj.get("resumo_situacao"):
            return obj
    return None


def _somar_meses(d: date, meses: int) -> date:
    total = d.month - 1 + meses
    return date(d.year + total // 12, total % 12 + 1, 1)


def normalizar_plano(bruto: dict, resumo: dict, hoje: date | None = None) -> dict:
    """Garante o schema fixo e acrescenta campos derivados (determinísticos) usados pela tela atual."""
    hoje = hoje or date.today()
    plano = bruto.get("plano") if isinstance(bruto.get("plano"), list) else []
    conteudo = {
        "resumo_situacao": str(bruto.get("resumo_situacao", "")),
        "prioridades": [str(p) for p in bruto.get("prioridades", [])] if isinstance(bruto.get("prioridades"), list) else [],
        "plano": [
            {
                "acao": str(i.get("acao", "")),
                "valor_estimado": None if i.get("valor_estimado") in (None, "") else str(i["valor_estimado"]),
                "prazo": str(i.get("prazo", "")),
                "prioridade": i.get("prioridade") if i.get("prioridade") in ("alta", "media", "baixa") else "media",
            }
            for i in plano if isinstance(i, dict)
        ],
        "projecao": str(bruto.get("projecao", "")),
    }

    # Campos derivados do resumo (não vêm da IA): ordem avalanche, data livre e saldo
    dividas = sorted(
        resumo.get("dividas", []),
        key=lambda d: (d["juros_mensal_pct"] is None, -(d["juros_mensal_pct"] or 0), -d["valor_restante"]),
    )
    ordem, ultima = [], None
    for n, d in enumerate(dividas, start=1):
        quitacao = _somar_meses(hoje, max(d["parcelas_restantes"], 0))
        ultima = quitacao if ultima is None or quitacao > ultima else ultima
        ordem.append({
            "ordem": n,
            "descricao": d["descricao"],
            "data_quitacao_estimada": quitacao.strftime("%Y-%m"),
            "motivo_prioridade": "Maior taxa de juros" if d["juros_mensal_pct"] else "Maior valor restante",
        })
    conteudo.update({
        "estrategia": "avalanche",
        "ordem_quitacao": ordem,
        "data_livre_prevista": ultima.strftime("%Y-%m") if ultima else None,
        "meses_ate_liberdade": max((d["parcelas_restantes"] for d in dividas), default=0),
        "saldo_disponivel_real": resumo.get("saldo_projetado_30_dias", 0.0),
    })
    return conteudo


async def gerar_plano_ia(resumo: dict, hoje: date | None = None) -> tuple[dict, str, int | None]:
    """Retorna (conteudo normalizado, texto bruto da IA, tokens). Levanta PlanoIAError se não vier JSON válido."""
    system_prompt, user_prompt = montar_prompt(resumo, hoje)
    tokens_total = 0
    for tentativa in range(1, MAX_TENTATIVAS_PARSE + 1):
        texto, tokens = await chamar_openrouter_com_uso(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=TEMPERATURE,
            max_tokens=MAX_TOKENS,
            response_format={"type": "json_object"},
            timeout=TIMEOUT_IA_SEGUNDOS,
        )
        tokens_total += tokens or 0
        bruto = extrair_json(texto)
        if bruto is not None:
            return normalizar_plano(bruto, resumo, hoje), texto, tokens_total or None
        logger.error("Plano IA: resposta sem JSON válido (tentativa %s/%s). Texto bruto: %.2000s",
                     tentativa, MAX_TENTATIVAS_PARSE, texto)
    raise PlanoIAError("Não foi possível interpretar a resposta da IA. Tente novamente em instantes.")
