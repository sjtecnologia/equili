"""
Assistente de voz — interpreta transcrição em linguagem natural e retorna
a ação estruturada a executar (criar conta a pagar, renda, etc.).
"""
import logging
from datetime import date

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.dependencies import CurrentUserID

router = APIRouter(prefix="/voz", tags=["Assistente de Voz"])
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = f"""Você é o assistente financeiro do Equili. O usuário falou algo em voz.
Interprete a intenção e extraia os dados necessários.

Data de hoje: {date.today().isoformat()}

Retorne APENAS um JSON válido com a estrutura abaixo, sem markdown, sem explicação:

═══ CONTAS A PAGAR ═══

Criar conta a pagar COM data:
{{"acao": "criar_conta_pagar", "dados": {{"descricao": "...", "valor": 0.00, "data_vencimento": "YYYY-MM-DD", "categoria": "outro", "modalidade": "avulsa"}}, "mensagem": "..."}}

Criar conta a pagar SEM data:
{{"acao": "pedir_data_vencimento", "dados": {{"descricao": "...", "valor": 0.00, "categoria": "outro", "modalidade": "avulsa", "_tipo_conta": "pagar"}}, "mensagem": "Qual a data de vencimento desta conta?"}}

Excluir/apagar conta a pagar (quando usuário diz "excluir", "apagar", "deletar", "remover" + descrição):
{{"acao": "excluir_conta_pagar", "dados": {{"descricao_busca": "..."}}, "mensagem": "..."}}
Exemplos: "excluir conta do condomínio" → {{"acao": "excluir_conta_pagar", "dados": {{"descricao_busca": "condomínio"}}, "mensagem": "Vou excluir a conta do condomínio."}}
"apagar conta de luz" → {{"acao": "excluir_conta_pagar", "dados": {{"descricao_busca": "luz"}}, "mensagem": "Vou excluir a conta de luz."}}

═══ CONTAS A RECEBER ═══

Criar conta a receber COM data:
{{"acao": "criar_conta_receber", "dados": {{"descricao": "...", "valor": 0.00, "data_vencimento": "YYYY-MM-DD"}}, "mensagem": "..."}}

Criar conta a receber SEM data:
{{"acao": "pedir_data_vencimento", "dados": {{"descricao": "...", "valor": 0.00, "_tipo_conta": "receber"}}, "mensagem": "Qual a data prevista para receber?"}}

Excluir conta a receber:
{{"acao": "excluir_conta_receber", "dados": {{"descricao_busca": "..."}}, "mensagem": "..."}}

═══ RENDA ═══

Registrar renda NOVA:
{{"acao": "criar_renda", "dados": {{"descricao": "...", "valor": 0.00, "tipo": "salario", "frequencia": "mensal"}}, "mensagem": "..."}}

Atualizar/mudar/corrigir renda existente — USE quando o usuário disser "mudar renda", "meu salário é", "atualizar renda", "corrigir renda", "meu salário mudou", "mudar de X para Y", "minha renda agora é":
{{"acao": "atualizar_renda", "dados": {{"valor": 0.00}}, "mensagem": "..."}}
Exemplos:
- "mudar minha renda de 2000 para 15000" → {{"acao": "atualizar_renda", "dados": {{"valor": 15000.00}}, "mensagem": "Vou atualizar sua renda para R$ 15.000,00."}}
- "meu salário agora é 8000" → {{"acao": "atualizar_renda", "dados": {{"valor": 8000.00}}, "mensagem": "Vou atualizar sua renda para R$ 8.000,00."}}
- "atualizar renda para 5000" → {{"acao": "atualizar_renda", "dados": {{"valor": 5000.00}}, "mensagem": "Vou atualizar sua renda para R$ 5.000,00."}}

Excluir renda (quando usuário diz "excluir renda", "remover renda", "apagar renda de X"):
{{"acao": "excluir_renda", "dados": {{"descricao_busca": "..."}}, "mensagem": "..."}}
Exemplos: "excluir minha renda de 2000" → {{"acao": "excluir_renda", "dados": {{"descricao_busca": ""}}, "mensagem": "Vou excluir a renda cadastrada."}}

Se não entender ou a ação não se encaixar:
{{"acao": "nao_entendido", "dados": {{}}, "mensagem": "Não entendi. Tente: 'Conta do condomínio 500 reais vence dia 10', 'Mudar minha renda para 5000', 'Excluir conta de luz'"}}

═══ REGRAS ═══
- modalidade: "avulsa" = único; "recorrente" = todo mês; "parcelada" = financiamento/parcelado
- data_vencimento: extraia se mencionada; senão use "pedir_data_vencimento"
- valor: sempre número decimal, sem R$
- categoria: alimentacao | transporte | saude | educacao | lazer | moradia | outro
- tipo de renda: salario | freela | aluguel | outro
- frequencia: mensal | quinzenal | semanal (padrão: mensal)
"""


class VozComandoRequest(BaseModel):
    transcricao: str = Field(min_length=1, max_length=1500)


class VozComandoResponse(BaseModel):
    acao: str
    dados: dict
    mensagem: str


class InterpretarDataRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=120)


class InterpretarDataResponse(BaseModel):
    data_iso: str | None = None


@router.post("/interpretar-data", response_model=InterpretarDataResponse)
async def interpretar_data(
    data: InterpretarDataRequest,
    usuario_id: CurrentUserID,
):
    """Interpreta uma expressão de data falada (ex: 'dia 10', 'quinze de maio') e retorna YYYY-MM-DD."""
    if not data.texto.strip():
        return InterpretarDataResponse(data_iso=None)

    if not settings.GITHUB_TOKEN:
        return InterpretarDataResponse(data_iso=None)

    hoje = date.today().isoformat()
    prompt = f"""Hoje é {hoje}. O usuário falou: "{data.texto.strip()}"
Interprete como uma data e retorne APENAS um JSON: {{"data_iso": "YYYY-MM-DD"}}
Se não conseguir interpretar, retorne: {{"data_iso": null}}
Sem explicações, apenas o JSON."""

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.GITHUB_MODELS_ENDPOINT}/chat/completions",
                headers={"Authorization": f"Bearer {settings.GITHUB_TOKEN}", "Content-Type": "application/json"},
                json={"model": settings.GITHUB_MODELS_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0, "max_tokens": 30},
            )
        resp.raise_for_status()
        import json
        content = resp.json()["choices"][0]["message"]["content"].strip()
        result = json.loads(content)
        return InterpretarDataResponse(data_iso=result.get("data_iso"))
    except Exception:
        return InterpretarDataResponse(data_iso=None)


@router.post("/comando", response_model=VozComandoResponse)
async def interpretar_comando(
    data: VozComandoRequest,
    usuario_id: CurrentUserID,
):
    if not data.transcricao.strip():
        raise HTTPException(status_code=400, detail="Transcrição vazia.")

    if not settings.GITHUB_TOKEN:
        raise HTTPException(status_code=503, detail="Serviço de IA não configurado.")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": data.transcricao.strip()},
    ]

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{settings.GITHUB_MODELS_ENDPOINT}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.GITHUB_MODELS_MODEL,
                    "messages": messages,
                    "temperature": 0.1,
                    "max_tokens": 300,
                },
            )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()

        import json
        result = json.loads(content)
        return VozComandoResponse(
            acao=result.get("acao", "nao_entendido"),
            dados=result.get("dados", {}),
            mensagem=result.get("mensagem", "Não entendi o comando."),
        )
    except (httpx.HTTPError, KeyError, ValueError) as e:
        logger.error("Erro ao interpretar comando de voz: %s", e)
        return VozComandoResponse(
            acao="nao_entendido",
            dados={},
            mensagem="Não consegui entender. Tente novamente.",
        )
