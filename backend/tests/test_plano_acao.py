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


def _mock_ai_response(monkeypatch):
    async def fake_post(self, url, headers=None, json=None, **kwargs):
        return _FakeAIResponse(
            {
                "usage": {"total_tokens": 512},
                "choices": [
                    {
                        "message": {
                            "content": '{"resumo_situacao": "Você está no caminho certo.", "estrategia": "avalanche", "justificativa_estrategia": "Priorizar juros maiores.", "valor_mensal_para_dividas": 1500.0, "saldo_disponivel_real": 700.0, "ordem_quitacao": [{"ordem": 1, "descricao": "Financiamento", "data_quitacao_estimada": "2026-03", "motivo_prioridade": "Maior juros"}], "data_livre_prevista": "2026-04", "meses_ate_liberdade": 3, "sugestoes_economia": ["Reduzir gastos", "Usar reserva"], "mensagem_motivacional": "Você consegue.", "alerta_fluxo_caixa": null}'
                        }
                    }
                ],
            }
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)


async def _fake_warning_event(**kwargs):
    return None


def test_gerar_plano_acao_usa_fluxo_de_caixa(finance_client, monkeypatch):
    client, user_id, session_factory = finance_client
    config_module.settings.GITHUB_TOKEN = "test-token"
    config_module.settings.GITHUB_MODELS_ENDPOINT = "https://example.com"
    config_module.settings.GITHUB_MODELS_MODEL = "gpt-test"
    config_module.settings.GITHUB_MODELS_API_KEY = "test-token"
    monkeypatch.setattr("app.core.rastro_client.rastro_client.send_warning_event", _fake_warning_event)
    _mock_ai_response(monkeypatch)

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
    assert payload["conteudo"]["estrategia"] == "avalanche"
    assert payload["conteudo"]["saldo_disponivel_real"] == 700.0
    assert payload["tokens_usados"] == 512


def test_plano_gratuito_limita_cota_mensal(finance_client, monkeypatch):
    client, user_id, session_factory = finance_client
    config_module.settings.GITHUB_TOKEN = "test-token"
    config_module.settings.GITHUB_MODELS_ENDPOINT = "https://example.com"
    config_module.settings.GITHUB_MODELS_MODEL = "gpt-test"
    config_module.settings.GITHUB_MODELS_API_KEY = "test-token"
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
