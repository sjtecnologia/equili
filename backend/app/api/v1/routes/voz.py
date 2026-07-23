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

Excluir/apagar conta a pagar:
{{"acao": "excluir_conta_pagar", "dados": {{"descricao_busca": "..."}}, "mensagem": "..."}}

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

Atualizar renda existente:
{{"acao": "atualizar_renda", "dados": {{"valor": 0.00}}, "mensagem": "..."}}

Excluir renda:
{{"acao": "excluir_renda", "dados": {{"descricao_busca": "..."}}, "mensagem": "..."}}

═══ DÍVIDAS ═══

Criar dívida COM data:
{{"acao": "criar_divida", "dados": {{"descricao": "...", "valor_total": 0.00, "valor_parcela": 0.00, "parcelas_restantes": 1, "tipo": "emprestimo", "credor": "...", "data_primeira_parcela": "YYYY-MM-DD"}}, "mensagem": "..."}}

Criar dívida SEM data:
{{"acao": "pedir_data_vencimento", "dados": {{"descricao": "...", "valor_total": 0.00, "valor_parcela": 0.00, "parcelas_restantes": 1, "tipo": "emprestimo", "credor": "...", "_tipo_conta": "divida"}}, "mensagem": "Qual a data da primeira parcela?"}}

Registrar pagamento de dívida COM data:
{{"acao": "registrar_pagamento_divida", "dados": {{"descricao_busca": "...", "valor_pago": 0.00, "data_pagamento": "YYYY-MM-DD"}}, "mensagem": "..."}}

Registrar pagamento de dívida SEM data:
{{"acao": "pedir_data_vencimento", "dados": {{"descricao_busca": "...", "valor_pago": 0.00, "_tipo_conta": "pagamento_divida"}}, "mensagem": "Qual a data do pagamento?"}}

Excluir dívida:
{{"acao": "excluir_divida", "dados": {{"descricao_busca": "..."}}, "mensagem": "..."}}

═══ INVESTIMENTOS ═══

Criar investimento:
{{"acao": "criar_investimento", "dados": {{"nome": "...", "tipo": "acoes", "valor_investido": 0.00, "data_investimento": "YYYY-MM-DD"}}, "mensagem": "..."}}

Atualizar valor de investimento:
{{"acao": "atualizar_investimento", "dados": {{"nome_busca": "...", "valor_atual": 0.00}}, "mensagem": "..."}}

Excluir investimento:
{{"acao": "excluir_investimento", "dados": {{"nome_busca": "..."}}, "mensagem": "..."}}

═══ LISTAS ═══

Adicionar afazer:
{{"acao": "criar_tarefa_lista", "dados": {{"titulo": "..."}}, "mensagem": "..."}}

Adicionar item na lista de compras:
{{"acao": "criar_item_compra_lista", "dados": {{"nome": "...", "quantidade": 1, "unidade": "un"}}, "mensagem": "..."}}

═══ AÇÕES RÁPIDAS ═══

Ver resumo/dashboard (quando usuário diz "como tá meu financeiro", "resumo", "visão geral", "status", "como estou"):
{{"acao": "navegar", "dados": {{"destino": "/dashboard"}}, "mensagem": "Vou mostrar seu resumo financeiro."}}

Ver contas a pagar:
{{"acao": "navegar", "dados": {{"destino": "/contas-pagar"}}, "mensagem": "Abrindo suas contas a pagar."}}

Ver contas a receber:
{{"acao": "navegar", "dados": {{"destino": "/contas-receber"}}, "mensagem": "Abrindo suas contas a receber."}}

Ver dívidas:
{{"acao": "navegar", "dados": {{"destino": "/dividas"}}, "mensagem": "Abrindo suas dívidas."}}

Ver investimentos:
{{"acao": "navegar", "dados": {{"destino": "/investimentos"}}, "mensagem": "Abrindo seus investimentos."}}

Ver listas (afazeres e compras):
{{"acao": "navegar", "dados": {{"destino": "/listas"}}, "mensagem": "Abrindo suas listas."}}

Se não entender ou a ação não se encaixar:
{{"acao": "nao_entendido", "dados": {{}}, "mensagem": "Não entendi. Tente: 'Conta do condomínio 500 reais', 'Registrar pagamento de 200 reais', 'Ver minhas dívidas'"}}

═══ REGRAS ═══
- modalidade: "avulsa" | "recorrente" | "parcelada"
- categoria: alimentacao | transporte | saude | educacao | lazer | moradia | outro
- tipo renda: salario | freela | aluguel | outro
- tipo divida: emprestimo | cartao_parcelado | financiamento | cheque_pre | outro
- tipo investimento: acoes | fii | renda_fixa | cripto | outro
- quantidade (lista de compras): número decimal maior que zero
- unidade (lista de compras): opcional, ex.: un, kg, g, l, ml, pacote
- data_vencimento: extraia se mencionada; senão use "pedir_data_vencimento"
- valor: sempre número decimal, sem R$
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
