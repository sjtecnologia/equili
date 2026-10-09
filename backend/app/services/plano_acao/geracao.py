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
MAX_TOKENS = 2000
TEMPERATURE = 0.3

SYSTEM_PROMPT = """Você é um consultor financeiro sênior brasileiro (padrão CFP) que recebeu os dados reais de um cliente. Monte um PLANO DE AÇÃO EXECUTÁVEL e ESPECÍFICO usando SOMENTE os dados do resumo.

REGRAS DE OURO:
1. FALE COM NÚMEROS E NOMES REAIS: cite credores, contas, cartões e categorias exatamente como aparecem no resumo. Proibido inventar credor, valor ou data.
2. DÉFICIT DE CAIXA: se "saldo_projetado_30_dias" for negativo, o PRIMEIRO passo do plano DEVE resolver o déficit (ex.: renegociar/adiar contas específicas, cortar a categoria certa com valor, ou aumentar renda com meta numérica).
3. ORDEM DE QUITAÇÃO: para passos de dívida, siga a ORDEM AVALANCHE fornecida no contexto (maior juros primeiro). Não a reordene.
4. PASSO CONCRETO, NUNCA GENÉRICO: "Pagar menos juros" ou "organizar as finanças" são RECUSADOS. "Renegociar com o credor X o saldo devedor de R$ Y" é aceito. Recomendações de corte de gasto DEVEM citar a categoria e um valor alvo (ex.: "Reduzir Alimentação de R$ X para R$ Y por mês").
5. FASES: imediato (0-15 dias), curto prazo (16-90 dias), médio prazo (91-365 dias). Distribua os passos entre as fases, do mais urgente ao menos urgente.
6. Entre 5 e 7 passos no total, cobrindo: déficit/emergências, negociação e quitação das dívidas específicas, corte de gastos com meta e aumento de renda/reforço de caixa.

FORMATO DE SAÍDA (obrigatório): responda SOMENTE com um objeto JSON válido, sem markdown, sem comentários e sem nenhum texto fora do JSON, exatamente neste schema:
{
  "resumo_situacao": "2-3 frases empáticas e objetivas citando os números-chave",
  "prioridades": ["string", 2 a 4 itens],
  "plano": [{"acao": "string com credor/categoria e valor concreto", "valor_estimado": "string ou null", "prazo": "string (ex.: até 15/10/2026)", "fase": "imediato|curto_prazo|medio_prazo", "prioridade": "alta|media|baixa"}],
  "projecao": "2-3 frases sobre a evolução esperada do caixa nos próximos meses",
  "sugestoes_economia": ["string", 2 a 4 itens específicos],
  "justificativa_estrategia": "1-2 frases explicando a estratégia e a ordem",
  "mensagem_motivacional": "1 frase curta e encorajadora",
  "alerta_fluxo_caixa": "string se houver risco nos próximos 30 dias; caso contrário null"
}"""

USER_TEMPLATE = """RESUMO FINANCEIRO (JSON compacto, valores em R$):
{resumo_json}

{contexto_adicional}

SITUAÇÃO: {situacao}
Data atual: {data}.
Gere o plano de ação completo seguindo as REGRAS DE OURO. Responda SOMENTE com o JSON do schema indicado, sem markdown e sem texto fora do JSON."""


class PlanoIAError(Exception):
    """Falha ao obter um plano válido da IA (mensagem já amigável)."""


def montar_ordem_avalanche(resumo: dict) -> str:
    """Digest determinístico da ordem de quitação (maior juros primeiro) para o prompt."""
    dividas = sorted(
        resumo.get("dividas", []),
        key=lambda d: (
            d.get("juros_mensal_pct") is None,
            -(d.get("juros_mensal_pct") or 0),
            -d.get("valor_restante", 0),
        ),
    )
    if not dividas:
        return ""
    linhas = ["ORDEM AVALANCHE RECOMENDADA (maior juros primeiro):"]
    for n, d in enumerate(dividas, start=1):
        juros = f"{d['juros_mensal_pct']:.1f}% a.m." if d.get("juros_mensal_pct") else "juros não informado"
        linhas.append(
            f"{n}. {d.get('descricao', 'Dívida')} — saldo devedor R$ {d.get('valor_restante', 0):,.2f} · "
            f"{d.get('parcelas_restantes', 0)} parcelas de R$ {d.get('valor_parcela', 0):,.2f} · {juros}"
        )
    return "\n".join(linhas)


def montar_prompt(resumo: dict, hoje: date | None = None) -> tuple[str, str]:
    hoje = hoje or date.today()
    endividado = bool(resumo.get("dividas")) or resumo.get("a_pagar_pendente", {}).get("vencido", 0) > 0
    if resumo.get("dividas"):
        situacao = "o usuário está ENDIVIDADO; foque o plano em quitar as dívidas listadas sem comprometer o caixa, seguindo a ordem avalanche."
    elif endividado:
        situacao = "sem dívidas cadastradas, mas há contas vencidas; foque em regularizar o caixa."
    else:
        situacao = "sem dívidas; foque em organizar o fluxo de caixa e começar a poupar."
    resumo_json = json.dumps(resumo, ensure_ascii=False, separators=(",", ":"))
    contexto_adicional = montar_ordem_avalanche(resumo)
    return SYSTEM_PROMPT, USER_TEMPLATE.format(
        resumo_json=resumo_json,
        contexto_adicional=contexto_adicional,
        situacao=situacao,
        data=hoje.strftime("%d/%m/%Y"),
    )


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


def _lista_strings(val) -> list[str]:
    """Normaliza listas de strings (prioridades/sugestões), com limite de itens."""
    if not isinstance(val, list):
        return []
    itens = []
    for x in val:
        if isinstance(x, str) and x.strip():
            itens.append(x.strip())
    return itens[:6]


def normalizar_plano(bruto: dict, resumo: dict, hoje: date | None = None) -> dict:
    """Garante o schema fixo e acrescenta campos derivados (determinísticos) usados pela tela atual."""
    hoje = hoje or date.today()
    plano = bruto.get("plano") if isinstance(bruto.get("plano"), list) else []
    conteudo = {
        "resumo_situacao": str(bruto.get("resumo_situacao", "")),
        "prioridades": _lista_strings(bruto.get("prioridades")),
        "plano": [
            {
                "acao": str(i.get("acao", "")).strip(),
                "valor_estimado": None if i.get("valor_estimado") in (None, "") else str(i["valor_estimado"]),
                "prazo": str(i.get("prazo", "")).strip(),
                "fase": i.get("fase") if i.get("fase") in ("imediato", "curto_prazo", "medio_prazo") else "curto_prazo",
                "prioridade": i.get("prioridade") if i.get("prioridade") in ("alta", "media", "baixa") else "media",
            }
            for i in plano
            if isinstance(i, dict) and str(i.get("acao", "")).strip()
        ],
        "projecao": str(bruto.get("projecao", "")),
        "sugestoes_economia": _lista_strings(bruto.get("sugestoes_economia")),
        "justificativa_estrategia": str(bruto.get("justificativa_estrategia", "")).strip(),
        "mensagem_motivacional": str(bruto.get("mensagem_motivacional", "")).strip(),
        "alerta_fluxo_caixa": (
            str(bruto["alerta_fluxo_caixa"]).strip() if bruto.get("alerta_fluxo_caixa") else None
        ),
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
