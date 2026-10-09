from __future__ import annotations

import asyncio
import json
from datetime import date, timedelta

import httpx
import pytest

from app.core import config as config_module
from app.models.conta_bancaria import CartaoCredito, ContaBancaria
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida
from app.models.lancamento_cartao import LancamentoCartao
from app.models.lancamento_conta import LancamentoConta
from app.models.renda import Renda
from app.services.plano_acao.geracao import (
    PlanoIAError,
    extrair_json,
    gerar_plano_ia,
    montar_prompt,
    normalizar_plano,
)
from app.services.plano_acao.resumo_financeiro import montar_resumo_financeiro

HOJE = date(2026, 10, 15)


def _seed(session_factory, user_id):
    async def run():
        async with session_factory() as s:
            conta = ContaBancaria(usuario_id=user_id, nome="CC", banco="B", tipo="corrente", saldo_inicial=1000.0)
            cartao = CartaoCredito(usuario_id=user_id, nome="Cart", bandeira="visa", limite=2000, limite_atual=1500,
                                   dia_fechamento=5, dia_vencimento=12)
            s.add_all([conta, cartao])
            await s.flush()
            s.add_all([
                LancamentoConta(conta_bancaria_id=conta.id, descricao="Salário", valor=300, tipo="entrada", data=HOJE),
                LancamentoConta(conta_bancaria_id=conta.id, descricao="Mercado", valor=100, tipo="saida", data=HOJE,
                                categoria="Alimentação"),
                LancamentoConta(conta_bancaria_id=conta.id, descricao="Antigo", valor=999, tipo="saida",
                                data=date(2026, 9, 1), categoria="Alimentação"),
                LancamentoCartao(cartao_credito_id=cartao.id, descricao="Pizza", valor=50, tipo="compra", data=HOJE,
                                 categoria="Alimentação"),
                LancamentoCartao(cartao_credito_id=cartao.id, descricao="Cinema", valor=30, tipo="compra", data=HOJE,
                                 categoria="Lazer"),
                Renda(usuario_id=user_id, descricao="Salário", valor=3000, frequencia="mensal", tipo="salario", ativo=True),
                Renda(usuario_id=user_id, descricao="Bico", valor=100, frequencia="semanal", tipo="freela", ativo=True),
                ContaAPagar(usuario_id=user_id, descricao="Luz", categoria="moradia", valor=200,
                            data_vencimento=HOJE - timedelta(days=2), status="vencido"),
                ContaAPagar(usuario_id=user_id, descricao="Aluguel", categoria="moradia", valor=1000,
                            data_vencimento=HOJE + timedelta(days=10), status="pendente"),
                ContaAPagar(usuario_id=user_id, descricao="Paga", categoria="outro", valor=777,
                            data_vencimento=HOJE, status="pago"),
                ContaAReceber(usuario_id=user_id, descricao="Freela", origem="freela", valor=500,
                              data_prevista=HOJE + timedelta(days=5), status="pendente"),
                Divida(usuario_id=user_id, descricao="Financiamento", credor="Banco", tipo="financiamento",
                       valor_total=5000, valor_parcela=500, parcelas_restantes=4, taxa_juros_mensal=0.02,
                       data_prox_vencimento=HOJE + timedelta(days=3)),
                Divida(usuario_id=user_id, descricao="Quitada", tipo="outro", valor_total=1, valor_parcela=1,
                       parcelas_restantes=0, quitada=True, data_prox_vencimento=HOJE),
            ])
            await s.commit()

    asyncio.run(run())


def test_resumo_financeiro_totais(finance_client):
    _, user_id, sf = finance_client
    _seed(sf, user_id)

    async def run():
        async with sf() as s:
            return await montar_resumo_financeiro(s, user_id, HOJE)

    r = asyncio.run(run())
    json.dumps(r)  # serializável, sem objetos ORM

    assert r["contas_bancarias"] == [{"nome": "CC", "saldo_atual": 1000 + 300 - 100 - 999}]
    assert r["saldo_total_contas"] == 201.0
    assert r["renda_mensal_total"] == pytest.approx(3000 + 100 * 52 / 12, abs=0.01)
    assert r["a_pagar_pendente"]["total"] == 1200.0 and r["a_pagar_pendente"]["vencido"] == 200.0
    assert r["a_pagar_pendente"]["proximos_30_dias"] == 1000.0 and r["a_pagar_pendente"]["quantidade"] == 2
    assert r["a_receber_pendente"]["total"] == 500.0
    assert r["saldo_projetado_30_dias"] == 201 + 500 - 1000 - 200
    assert len(r["dividas"]) == 1
    d = r["dividas"][0]
    assert d["valor_restante"] == 2000.0 and d["parcelas_restantes"] == 4 and d["juros_mensal_pct"] == 2.0
    assert r["cartoes"][0]["fatura_pendente"] == 500.0 and r["cartoes"][0]["limite_total"] == 2000.0
    # só o mês corrente: Alimentação = 100 (conta) + 50 (cartão); o lançamento de setembro fica fora
    assert r["top_categorias_saida_mes"] == [
        {"categoria": "Alimentação", "total": 150.0}, {"categoria": "Lazer", "total": 30.0},
    ]


def test_prompt_contem_resumo_e_instrucoes_json():
    resumo = {"dividas": [{"descricao": "X"}], "a_pagar_pendente": {"vencido": 0}, "renda_mensal_total": 1234.5}
    system, user = montar_prompt(resumo, HOJE)
    assert json.dumps(resumo, ensure_ascii=False, separators=(",", ":")) in user
    assert "ENDIVIDADO" in user and "15/10/2026" in user
    for chave in ("resumo_situacao", "prioridades", "plano", "valor_estimado", "prazo", "projecao", "alta|media|baixa"):
        assert chave in system
    assert "SOMENTE" in system and "sem markdown" in system


def test_extrair_json_robusto():
    ok = '{"resumo_situacao": "a"}'
    assert extrair_json(ok) == {"resumo_situacao": "a"}
    assert extrair_json(f"Claro! ```json\n{ok}\n``` espero ter ajudado") == {"resumo_situacao": "a"}
    assert extrair_json("sem json aqui") is None
    assert extrair_json('{"outro": 1}') is None


def test_normalizar_plano_preenche_schema_e_ordem_avalanche():
    resumo = {
        "dividas": [
            {"descricao": "Sem juros", "parcelas_restantes": 2, "valor_restante": 900, "juros_mensal_pct": None},
            {"descricao": "Cartão", "parcelas_restantes": 5, "valor_restante": 300, "juros_mensal_pct": 8.0},
        ],
        "saldo_projetado_30_dias": 10.0,
    }
    c = normalizar_plano({"resumo_situacao": "ok", "plano": [{"acao": "a", "prioridade": "x"}]}, resumo, HOJE)
    assert c["prioridades"] == [] and c["projecao"] == ""
    assert c["plano"][0] == {
        "acao": "a", "valor_estimado": None, "prazo": "",
        "fase": "curto_prazo", "prioridade": "media",
    }
    assert [o["descricao"] for o in c["ordem_quitacao"]] == ["Cartão", "Sem juros"]
    assert c["data_livre_prevista"] == "2027-03" and c["meses_ate_liberdade"] == 5


def _config(monkeypatch):
    config_module.settings.OPENROUTER_API_KEY = "test-token"
    monkeypatch.setattr("app.services.openrouter.asyncio.sleep", lambda *_: asyncio.sleep(0))


def _fake_respostas(monkeypatch, textos):
    chamadas = []

    class Resp:
        def __init__(self, texto):
            self.texto = texto

        def raise_for_status(self):
            return None

        def json(self):
            return {"usage": {"total_tokens": 10}, "choices": [{"message": {"content": self.texto}}]}

    async def fake_post(self, url, headers=None, json=None, **kwargs):
        chamadas.append(json)
        return Resp(textos[min(len(chamadas) - 1, len(textos) - 1)])

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return chamadas


def test_gerar_plano_ia_retry_uma_vez_e_depois_erro(monkeypatch):
    _config(monkeypatch)
    resumo = {"dividas": [], "a_pagar_pendente": {"vencido": 0}}

    chamadas = _fake_respostas(monkeypatch, ["lixo", '{"resumo_situacao": "ok"}'])
    conteudo, _, tokens = asyncio.run(gerar_plano_ia(resumo, HOJE))
    assert conteudo["resumo_situacao"] == "ok" and len(chamadas) == 2 and tokens == 20

    chamadas = _fake_respostas(monkeypatch, ["lixo"])
    with pytest.raises(PlanoIAError):
        asyncio.run(gerar_plano_ia(resumo, HOJE))
    assert len(chamadas) == 2  # no máximo 1 tentativa extra
