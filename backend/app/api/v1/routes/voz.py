"""
Assistente de voz — interpreta transcrição em linguagem natural e retorna
a ação estruturada a executar (criar conta a pagar, renda, etc.).
"""
import logging
from datetime import date

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.dependencies import CurrentUserID

router = APIRouter(prefix="/voz", tags=["Assistente de Voz"])
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = f"""Você é o assistente financeiro do Equili. O usuário falou algo em voz.
Interprete a intenção e extraia os dados necessários.

Data de hoje: {date.today().isoformat()}

Retorne APENAS um JSON válido com a estrutura abaixo, sem markdown, sem explicação:

Para criar uma conta a pagar (quando o usuário mencionar data de vencimento):
{{"acao": "criar_conta_pagar", "dados": {{"descricao": "...", "valor": 0.00, "data_vencimento": "YYYY-MM-DD", "categoria": "outro", "modalidade": "avulsa"}}, "mensagem": "Resumo amigável do que será feito"}}

Para criar uma conta a pagar SEM data mencionada (perguntar antes):
{{"acao": "pedir_data_vencimento", "dados": {{"descricao": "...", "valor": 0.00, "categoria": "outro", "modalidade": "avulsa", "_tipo_conta": "pagar"}}, "mensagem": "Qual a data de vencimento desta conta?"}}

Para criar uma conta a receber (quando o usuário mencionar data):
{{"acao": "criar_conta_receber", "dados": {{"descricao": "...", "valor": 0.00, "data_vencimento": "YYYY-MM-DD"}}, "mensagem": "Resumo amigável do que será feito"}}

Para criar uma conta a receber SEM data mencionada (perguntar antes):
{{"acao": "pedir_data_vencimento", "dados": {{"descricao": "...", "valor": 0.00, "_tipo_conta": "receber"}}, "mensagem": "Qual a data prevista para receber?"}}

Para registrar uma renda:
{{"acao": "criar_renda", "dados": {{"descricao": "...", "valor": 0.00, "tipo": "salario", "frequencia": "mensal"}}, "mensagem": "Resumo amigável do que será feito"}}

Para atualizar/mudar o valor de uma renda existente (quando o usuário diz "mudar", "atualizar", "corrigir" renda/salário):
{{"acao": "atualizar_renda", "dados": {{"valor": 0.00}}, "mensagem": "Resumo amigável do que será feito"}}

Se não entender ou a ação não se encaixar nessas categorias:
{{"acao": "nao_entendido", "dados": {{}}, "mensagem": "Não entendi. Tente: 'Conta recorrente do condomínio 500 reais vence dia 10' ou 'Recebi 2000 reais de salário'"}}

Regras importantes:
- modalidade: "avulsa" = conta única; "recorrente" = mensal todo mês; "parcelada" = financiamento/parcelado
  - Se o usuário disser "recorrente", "todo mês", "mensalmente" → modalidade = "recorrente"
  - Se o usuário disser "parcelado", "financiamento", "em X vezes" → modalidade = "parcelada"
  - Caso contrário → modalidade = "avulsa"
- data_vencimento: se mencionada (ex.: "dia 10", "todo dia 5", "vence amanhã") → extraia a data. Se NÃO mencionada → use ação "pedir_data_vencimento"
- valor: sempre número decimal, sem R$
- categoria para contas a pagar: alimentacao | transporte | saude | educacao | lazer | moradia | outro
- tipo para renda: salario | freela | aluguel | outro
- frequencia para renda: mensal | quinzenal | semanal (padrão: mensal)
"""


class VozComandoRequest(BaseModel):
    transcricao: str


class VozComandoResponse(BaseModel):
    acao: str
    dados: dict
    mensagem: str


class InterpretarDataRequest(BaseModel):
    texto: str


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
