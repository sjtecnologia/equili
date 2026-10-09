from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core import config as config_module
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida
from app.models.plano_acao import PlanoAcao
from app.models.renda import Renda


class _FakeAIResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


CONTEUDO_IA = (
    '{"resumo_situacao": "Você está no caminho certo.", "prioridades": ["Quitar o financiamento"], '
    '"plano": [{"acao": "Pagar parcela", "valor_estimado": "R$ 1200", "prazo": "este mês", "prioridade": "alta"}], '
    '"projecao": "Caixa positivo nos próximos 3 meses."}'
)


def _mock_ai_response(monkeypatch, conteudo=CONTEUDO_IA, capturado=None):
    async def fake_post(self, url, headers=None, json=None, **kwargs):
        if capturado is not None:
            capturado.append(json)
        return _FakeAIResponse({"usage": {"total_tokens": 512}, "choices": [{"message": {"content": conteudo}}]})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)


async def _fake_warning_event(**kwargs):
    return None


def test_gerar_plano_acao_usa_fluxo_de_caixa(finance_client, monkeypatch):
    client, user_id, session_factory = finance_client
    config_module.settings.OPENROUTER_API_KEY = "test-token"
    config_module.settings.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
    config_module.settings.OPENROUTER_CHAT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
    config_module.settings.OPENROUTER_FALLBACK_MODEL = "google/gemma-4-26b-a4b-it:free"
    monkeypatch.setattr("app.core.rastro_client.rastro_client.send_warning_event", _fake_warning_event)
    enviados: list = []
    _mock_ai_response(monkeypatch, capturado=enviados)

    async def seed_business_state():
        hoje = date.today()
        async with session_factory() as session:
            session.add(Renda(usuario_id=user_id, descricao="Salário", valor=5000.0, frequencia="mensal", tipo="salario", ativo=True))
            session.add(
                ContaAPagar(
                    usuario_id=user_id,
                    descricao="Aluguel",
                    categoria="moradia",
                    valor=1200.0,
                    data_vencimento=hoje + timedelta(days=12),
                    status="pendente",
                    tipo="fixa",
                )
            )
            session.add(
                ContaAReceber(
                    usuario_id=user_id,
                    descricao="Freela",
                    origem="freela",
                    valor=2500.0,
                    data_prevista=hoje + timedelta(days=5),
                    status="pendente",
                    tipo="avulsa",
                )
            )
            session.add(
                Divida(
                    usuario_id=user_id,
                    descricao="Financiamento",
                    credor="Banco",
                    tipo="financiamento",
                    valor_total=8000.0,
                    valor_parcela=1200.0,
                    parcelas_totais=8,
                    parcelas_restantes=7,
                    data_prox_vencimento=hoje + timedelta(days=3),
                    data_primeira_parcela=hoje + timedelta(days=3),
                )
            )
            await session.commit()

    asyncio.run(seed_business_state())

    response = client.post("/api/v1/plano-acao/gerar")

    assert response.status_code == 201, response.text
    payload = response.json()
    conteudo = payload["conteudo"]
    assert conteudo["resumo_situacao"] == "Você está no caminho certo."
    assert conteudo["plano"][0]["prioridade"] == "alta"
    assert conteudo["estrategia"] == "avalanche"
    # 0 em contas + 2500 a receber em 30d - 1200 a pagar em 30d
    assert conteudo["saldo_disponivel_real"] == 1300.0
    assert conteudo["ordem_quitacao"][0]["descricao"] == "Financiamento"
    assert payload["tokens_usados"] == 512

    # a IA recebe o resumo compacto e pede JSON, com parâmetros ajustados
    corpo = enviados[0]
    assert corpo["temperature"] == 0.3 and corpo["max_tokens"] == 2000
    assert corpo["response_format"] == {"type": "json_object"}
    assert '"renda_mensal_total":5000.0' in corpo["messages"][1]["content"]


def test_plano_gratuito_limita_cota_mensal(finance_client, monkeypatch):
    client, user_id, session_factory = finance_client
    config_module.settings.OPENROUTER_API_KEY = "test-token"
    config_module.settings.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
    config_module.settings.OPENROUTER_CHAT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
    config_module.settings.OPENROUTER_FALLBACK_MODEL = "google/gemma-4-26b-a4b-it:free"
    config_module.settings.PLANO_GRATIS_MAX_PLANOS_IA_MES = 1
    monkeypatch.setattr("app.core.rastro_client.rastro_client.send_warning_event", _fake_warning_event)

    async def seed_limit_state():
        hoje = date.today()
        async with session_factory() as session:
            session.add(Renda(usuario_id=user_id, descricao="Salário", valor=5000.0, frequencia="mensal", tipo="salario", ativo=True))
            session.add(
                PlanoAcao(
                    usuario_id=user_id,
                    conteudo={"resumo_situacao": "teste"},
                    conteudo_texto="teste",
                    estrategia="avalanche",
                    data_livre_prevista=hoje + timedelta(days=30),
                    criado_em=datetime.now(timezone.utc),
                )
            )
            session.add(
                PlanoAcao(
                    usuario_id=user_id,
                    conteudo={"resumo_situacao": "teste 2"},
                    conteudo_texto="teste 2",
                    estrategia="avalanche",
                    data_livre_prevista=hoje + timedelta(days=30),
                    criado_em=datetime.now(timezone.utc),
                )
            )
            await session.commit()

    asyncio.run(seed_limit_state())

    response = client.post("/api/v1/plano-acao/gerar")

    assert response.status_code == 429, response.text
    payload = response.json()
    assert "limite" in payload["detail"].lower()
