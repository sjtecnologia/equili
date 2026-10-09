from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone

from app.models.categoria import Categoria
from app.models.conta_bancaria import CartaoCredito, ContaBancaria
from app.models.divida import Divida, DividaPagamento
from app.models.investimento import Investimento
from app.models.listas import ItemCompra, Tarefa
from app.models.nfs_recebida import NfsRecebida


def _add(session_factory, *objs):
    async def run():
        async with session_factory() as s:
            s.add_all(objs)
            await s.commit()

    asyncio.run(run())


def _nomes(resp, campo="descricao"):
    assert resp.status_code == 200, resp.text
    return {i[campo] for i in resp.json()}


def _set_plano(session_factory, user_id, plano):
    from app.models.usuario import Usuario

    async def run():
        async with session_factory() as s:
            u = await s.get(Usuario, user_id)
            u.plano = plano
            await s.commit()

    asyncio.run(run())


def test_filtros_dividas_e_baixas(finance_client):
    client, user_id, sf = finance_client
    d1 = Divida(usuario_id=user_id, descricao="Financiamento Carro", credor="Banco X", tipo="financiamento",
                valor_total=1000, valor_parcela=100, parcelas_restantes=10, data_prox_vencimento=date(2026, 11, 10))
    d2 = Divida(usuario_id=user_id, descricao="Cartão Loja", credor="Loja Y", tipo="cartao", valor_total=500,
                valor_parcela=50, parcelas_restantes=0, quitada=True, data_prox_vencimento=date(2026, 1, 5))
    _add(sf, d1, d2)
    _add(sf,
         DividaPagamento(divida_id=d1.id, usuario_id=user_id, data_referencia=date(2026, 10, 10),
                         data_pagamento=date(2026, 10, 9), valor_pago=100, valor_parcela_original=100, observacao="ok"),
         DividaPagamento(divida_id=d2.id, usuario_id=user_id, data_referencia=date(2026, 1, 5),
                         data_pagamento=date(2026, 1, 4), valor_pago=50, valor_parcela_original=50))

    assert _nomes(client.get("/api/v1/dividas")) == {"Financiamento Carro", "Cartão Loja"}
    assert _nomes(client.get("/api/v1/dividas", params={"q": "banco"})) == {"Financiamento Carro"}
    assert _nomes(client.get("/api/v1/dividas", params={"status": "quitadas"})) == {"Cartão Loja"}
    assert _nomes(client.get("/api/v1/dividas", params={"data_inicio": "2026-06-01"})) == {"Financiamento Carro"}
    assert _nomes(client.get("/api/v1/dividas", params={"q": "inexistente"})) == set()

    pag = "divida_descricao"
    assert len(client.get("/api/v1/dividas/pagamentos").json()) == 2
    assert _nomes(client.get("/api/v1/dividas/pagamentos", params={"q": "loja"}), pag) == {"Cartão Loja"}
    assert _nomes(client.get("/api/v1/dividas/pagamentos", params={"valor_min": 80}), pag) == {"Financiamento Carro"}
    assert _nomes(client.get("/api/v1/dividas/pagamentos", params={"data_fim": "2026-02-01"}), pag) == {"Cartão Loja"}


def test_filtros_investimentos(finance_client):
    client, user_id, sf = finance_client
    _set_plano(sf, user_id, "premium")  # investimentos é recurso Premium
    _add(sf,
         Investimento(usuario_id=user_id, nome="IVVB11", tipo="acoes", instituicao="XP", valor_investido=100,
                      valor_atual=110, data_aplicacao=date(2026, 3, 1)),
         Investimento(usuario_id=user_id, nome="CDB Banco", tipo="renda_fixa", instituicao="Nubank",
                      valor_investido=200, valor_atual=210, data_aplicacao=date(2026, 8, 1)))

    assert _nomes(client.get("/api/v1/investimentos"), "nome") == {"IVVB11", "CDB Banco"}
    assert _nomes(client.get("/api/v1/investimentos", params={"tipo": "acoes"}), "nome") == {"IVVB11"}
    assert _nomes(client.get("/api/v1/investimentos", params={"q": "nubank"}), "nome") == {"CDB Banco"}
    assert _nomes(client.get("/api/v1/investimentos", params={"data_inicio": "2026-06-01"}), "nome") == {"CDB Banco"}


def test_filtros_lancamentos_conta_e_cartao(finance_client):
    client, user_id, sf = finance_client
    conta = ContaBancaria(usuario_id=user_id, nome="CC", banco="B", tipo="corrente", saldo_inicial=0)
    cartao = CartaoCredito(usuario_id=user_id, nome="Cart", bandeira="visa", limite=1000, limite_atual=1000,
                           dia_fechamento=5, dia_vencimento=12)
    _add(sf, conta, cartao)
    for desc, tipo, cat, dia in (("Mercado", "saida", "Alimentação", "2026-10-01"),
                                  ("Salário", "entrada", "Salário", "2026-09-01")):
        r = client.post(f"/api/v1/contas-bancarias/{conta.id}/lancamentos",
                        json={"descricao": desc, "valor": 10, "tipo": tipo, "data": dia, "categoria": cat})
        assert r.status_code == 201, r.text
    for desc, tipo, cat, dia in (("Pizza", "compra", "Alimentação", "2026-10-02"),
                                  ("Fatura", "pagamento", "Outros", "2026-09-02")):
        r = client.post(f"/api/v1/cartoes-credito/{cartao.id}/lancamentos",
                        json={"descricao": desc, "valor": 10, "tipo": tipo, "data": dia, "categoria": cat})
        assert r.status_code == 201, r.text

    def lanc(url, **params):
        r = client.get(url, params=params)
        assert r.status_code == 200, r.text
        return {l["descricao"] for l in r.json()["lancamentos"]}, r.json()

    u = f"/api/v1/contas-bancarias/{conta.id}/lancamentos"
    assert lanc(u)[0] == {"Mercado", "Salário"}
    assert lanc(u, tipo="entrada")[0] == {"Salário"}
    assert lanc(u, categoria="alimentação")[0] == {"Mercado"}
    assert lanc(u, q="merc")[0] == {"Mercado"}
    nomes, corpo = lanc(u, data_inicio="2026-10-01")
    assert nomes == {"Mercado"} and corpo["saldo_atual"] == 0.0  # saldo real, independe do filtro

    u = f"/api/v1/cartoes-credito/{cartao.id}/lancamentos"
    assert lanc(u)[0] == {"Pizza", "Fatura"}
    assert lanc(u, tipo="pagamento")[0] == {"Fatura"}
    assert lanc(u, categoria="Alimentação")[0] == {"Pizza"}
    assert lanc(u, data_fim="2026-09-30")[0] == {"Fatura"}


def test_filtros_listas_categorias_e_nfs(finance_client):
    client, user_id, sf = finance_client
    _set_plano(sf, user_id, "pro")  # NFS é recurso do plano Pro
    _add(sf,
         Tarefa(usuario_id=user_id, titulo="Pagar luz", concluida=False),
         Tarefa(usuario_id=user_id, titulo="Ligar banco", concluida=True),
         ItemCompra(usuario_id=user_id, nome="Arroz", quantidade=1, comprado=False, observacao="integral"),
         ItemCompra(usuario_id=user_id, nome="Feijão", quantidade=1, comprado=True))
    assert _nomes(client.get("/api/v1/listas/tarefas", params={"concluida": "true"}), "titulo") == {"Ligar banco"}
    assert _nomes(client.get("/api/v1/listas/tarefas", params={"q": "LUZ"}), "titulo") == {"Pagar luz"}
    assert _nomes(client.get("/api/v1/listas/compras", params={"comprado": "false"}), "nome") == {"Arroz"}
    assert _nomes(client.get("/api/v1/listas/compras", params={"q": "integral"}), "nome") == {"Arroz"}

    for nome, tipo in (("Mercado", "despesa"), ("Salario", "receita")):
        assert client.post("/api/v1/categorias", json={"nome": nome, "tipo": tipo}).status_code == 201
    assert _nomes(client.get("/api/v1/categorias", params={"q": "merc"}), "nome") == {"Mercado"}
    assert _nomes(client.get("/api/v1/categorias", params={"tipo": "receita"}), "nome") == {"Salario"}

    _add(sf,
         NfsRecebida(user_id=user_id, numero="100", serie="A", valor=50, chave_acesso="CH1", cpf_cnpj="111",
                     data_emissao=datetime(2026, 3, 1, 12, tzinfo=timezone.utc)),
         NfsRecebida(user_id=user_id, numero="200", valor=500, chave_acesso="CH2", cpf_cnpj="222",
                     data_emissao=datetime(2026, 9, 1, 12, tzinfo=timezone.utc)))
    assert _nomes(client.get("/api/v1/nfs"), "numero") == {"100", "200"}
    assert _nomes(client.get("/api/v1/nfs", params={"q": "222"}), "numero") == {"200"}
    assert _nomes(client.get("/api/v1/nfs", params={"valor_min": 100}), "numero") == {"200"}
    assert _nomes(client.get("/api/v1/nfs", params={"data_fim": "2026-03-01"}), "numero") == {"100"}
    assert _nomes(client.get("/api/v1/nfs", params={"data_inicio": "2026-04-01"}), "numero") == {"200"}
