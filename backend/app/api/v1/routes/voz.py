"""
Assistente de voz — interpreta transcrição em linguagem natural e retorna
a ação estruturada a executar (criar conta a pagar, renda, etc.).
"""
import logging
from datetime import date, timedelta

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

Para criar uma conta a pagar:
{{"acao": "criar_conta_pagar", "dados": {{"descricao": "...", "valor": 0.00, "data_vencimento": "YYYY-MM-DD", "categoria": "outros"}}, "mensagem": "Resumo amigável do que será feito"}}

Para criar uma conta a receber:
{{"acao": "criar_conta_receber", "dados": {{"descricao": "...", "valor": 0.00, "data_vencimento": "YYYY-MM-DD"}}, "mensagem": "Resumo amigável do que será feito"}}

Para registrar uma renda:
{{"acao": "criar_renda", "dados": {{"descricao": "...", "valor": 0.00, "tipo": "fixo"}}, "mensagem": "Resumo amigável do que será feito"}}

Se não entender ou a ação não se encaixar nessas categorias:
{{"acao": "nao_entendido", "dados": {{}}, "mensagem": "Não entendi. Tente: 'Paguei 50 reais no mercado' ou 'Recebi 200 reais de freelance'"}}

Regras:
- data_vencimento: se não mencionada, use amanhã ({(date.today() + timedelta(days=1)).isoformat()})
- valor: sempre número decimal, sem R$
- categoria para contas a pagar: alimentacao | transporte | saude | educacao | lazer | moradia | outros
- tipo para renda: fixo | variavel | extra
"""


class VozComandoRequest(BaseModel):
    transcricao: str


class VozComandoResponse(BaseModel):
    acao: str
    dados: dict
    mensagem: str


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
