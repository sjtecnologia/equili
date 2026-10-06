import asyncio
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.conta_bancaria import ContaBancaria, CartaoCredito
from app.models.conta_lancamento import BaixaConta
from app.models.usuario import Usuario


def seed(sf, user_id):
    async def run():
        async with sf() as s:
            bancos = [ContaBancaria(usuario_id=user_id, nome=n, banco="B", tipo="corrente", saldo_inicial=1000) for n in ("A", "B")]
            cartao = CartaoCredito(usuario_id=user_id, nome="C", bandeira="visa", limite=1000, limite_atual=1000, dia_fechamento=5, dia_vencimento=12)
            s.add_all([*bancos, cartao])
            await s.commit()
            return [str(b.id) for b in bancos], str(cartao.id)
    return asyncio.run(run())


def criar(client, lado, valor=100, modalidade="avulsa"):
    payload = {"descricao": "Teste", "valor": valor, "modalidade": modalidade, "numero_parcelas": 3,
               **({"origem": "freela", "data_prevista": date.today().isoformat()} if lado == "receber" else {"categoria": "moradia", "data_vencimento": date.today().isoformat()})}
    r = client.post(f"/api/v1/contas-{lado}", json=payload)
    assert r.status_code == 201, r.text
    return r.json()[0]["id"]


def saldo(client, banco):
    r = client.get(f"/api/v1/contas-bancarias/{banco}/lancamentos")
    assert r.status_code == 200, r.text
    return r.json()["saldo_atual"]


@pytest.mark.parametrize("lado,sinal,liquidado", [("pagar", -1, "pago"), ("receber", 1, "recebido")])
def test_parcial_complemento_estorno_e_correcao(finance_client, lado, sinal, liquidado):
    client, uid, sf = finance_client
    bancos, _ = seed(sf, uid)
    cid = criar(client, lado)
    base = f"/api/v1/contas-{lado}/{cid}/baixas"
    r = client.post(base, json={"valor": 30, "meio": "conta", "conta_id": bancos[0], "data": "2026-10-01"})
    assert r.status_code == 201, r.text
    primeira = r.json()["id"]
    conta = client.get(f"/api/v1/contas-{lado}").json()[0]
    assert conta["status"] == "parcial" and conta["valor_baixado"] == 30
    assert saldo(client, bancos[0]) == 1000 + sinal * 30
    r = client.post(base, json={"meio": "conta", "conta_id": bancos[0]})
    assert r.status_code == 201, r.text
    segunda = r.json()["id"]
    assert r.json()["valor"] == 70
    assert client.get(f"/api/v1/contas-{lado}").json()[0]["status"] == liquidado
    r = client.patch(f"{base}/{primeira}", json={"valor": 20, "data": "2026-10-02", "meio": "conta", "conta_id": bancos[1]})
    assert r.status_code == 200, r.text
    assert saldo(client, bancos[0]) == 1000 + sinal * 70
    assert saldo(client, bancos[1]) == 1000 + sinal * 20
    nova = r.json()["id"]
    assert client.delete(f"{base}/{segunda}").status_code == 204
    assert saldo(client, bancos[0]) == 1000
    assert client.delete(f"{base}/{nova}").status_code == 204
    assert saldo(client, bancos[1]) == 1000
    assert client.delete(f"{base}/{nova}").status_code == 409
    assert len(client.get(base).json()) == 3
    assert client.get(f"/api/v1/contas-{lado}").json()[0]["valor_baixado"] == 0
    assert client.delete(f"/api/v1/contas-{lado}/{cid}").status_code == 409


def test_correcao_invalida_preserva_baixa_e_saldo(finance_client):
    client, uid, sf = finance_client
    bancos, _ = seed(sf, uid)
    cid = criar(client, "pagar")
    base = f"/api/v1/contas-pagar/{cid}/baixas"
    bid = client.post(base, json={"valor": 40, "conta_id": bancos[0], "meio": "conta"}).json()["id"]
    for payload in ({"valor": 101}, {"valor": 40, "conta_id": str(uuid4()), "meio": "conta"}):
        r = client.patch(f"{base}/{bid}", json=payload)
        assert r.status_code in (404, 422), r.text
        assert saldo(client, bancos[0]) == 960
        assert client.get(base).json()[0]["cancelada_em"] is None
    assert client.post(base, json={"valor": 61}).status_code == 422
    assert client.post(base, json={"valor": 0}).status_code == 422
    assert client.post(base, json={"valor": -10}).status_code == 422
    assert client.post(base, json={"valor": 1.001}).status_code == 422
    assert client.patch(f"/api/v1/contas-pagar/{cid}", json={"valor": 20}).status_code == 422


def test_estorno_cartao_restaura_limite_e_troca_para_banco(finance_client):
    client, uid, sf = finance_client
    bancos, cartao = seed(sf, uid)
    cid = criar(client, "pagar")
    base = f"/api/v1/contas-pagar/{cid}/baixas"
    r = client.post(base, json={"valor": 30, "cartao_id": cartao, "meio": "cartao"})
    assert r.status_code == 201, r.text
    def limite():
        async def run():
            async with sf() as s:
                from uuid import UUID
                return float((await s.get(CartaoCredito, UUID(cartao))).limite_atual)
        return asyncio.run(run())
    assert limite() == 970
    r = client.patch(f"{base}/{r.json()['id']}", json={"conta_id": bancos[0], "meio": "conta"})
    assert r.status_code == 200, r.text
    assert limite() == 1000
    assert saldo(client, bancos[0]) == 970


def test_filtros_relatorio_parcelas_e_totais(finance_client):
    client, uid, sf = finance_client
    bancos, _ = seed(sf, uid)
    cid = criar(client, "pagar", modalidade="parcelada")
    criar(client, "receber")
    r = client.post(f"/api/v1/contas-pagar/{cid}/baixas", json={"valor": 25, "meio": "conta", "conta_id": bancos[0]})
    assert r.status_code == 201
    url = "/api/v1/relatorio/parcelas"
    assert len(client.get(url).json()) == 4
    r = client.get(url, params={"natureza": "pagar", "tipo": "parcelada", "parcela": 1, "status": "parcial", "categoria": "moradia", "conta_id": bancos[0], "q": "Teste"})
    assert r.status_code == 200, r.text
    linhas = r.json()
    assert len(linhas) == 1
    assert linhas[0]["parcela"] == "1/3"
    assert linhas[0]["valor_baixado"] == 25 and linhas[0]["saldo_restante"] == 75
    assert client.get(url, params={"status": "liquidado"}).json() == []
    assert client.get(url, params={"natureza": "receber", "tipo": "parcelada"}).json() == []
    assert client.get(url, params={"data_inicio": "2026-12-31", "data_fim": "2026-01-01"}).status_code == 422
    assert client.get(url, params={"conta_id": "invalid"}).status_code == 422
    assert len(client.get("/api/v1/contas-pagar", params={"tipo": "variavel"}).json()) == 3
    assert client.get("/api/v1/contas-pagar", params={"tipo": "fixa"}).json() == []


def test_nao_acessa_baixa_de_outro_usuario(finance_client):
    client, uid, sf = finance_client
    cid = criar(client, "receber")
    base = f"/api/v1/contas-receber/{cid}/baixas"
    bid = client.post(base, json={"valor": 10}).json()["id"]
    outro_cid = criar(client, "receber")
    assert client.delete(f"/api/v1/contas-receber/{outro_cid}/baixas/{bid}").status_code == 404
    async def alterar():
        async with sf() as s:
            outro = Usuario(nome="Outro", email="outro@example.com", senha_hash="hash", ativo=True)
            s.add(outro)
            await s.flush()
            baixa = await s.scalar(select(BaixaConta))
            baixa.usuario_id = outro.id
            await s.commit()
    asyncio.run(alterar())
    assert client.delete(f"{base}/{bid}").status_code == 404


def test_baixa_e_estorno_sincronizam_parcela_da_divida(finance_client):
    client, _, _ = finance_client
    r = client.post("/api/v1/dividas", json={
        "descricao": "Emprestimo", "tipo": "emprestimo", "valor_total": 200,
        "valor_parcela": 100, "parcelas_totais": 2, "parcelas_restantes": 2,
        "data_primeira_parcela": date.today().isoformat(), "data_prox_vencimento": date.today().isoformat(),
    })
    assert r.status_code == 201, r.text
    did = r.json()["id"]
    cid = client.get("/api/v1/contas-pagar").json()[0]["id"]
    base = f"/api/v1/contas-pagar/{cid}/baixas"
    bid = client.post(base, json={"valor": 100}).json()["id"]
    assert len(client.get(f"/api/v1/dividas/{did}/pagamentos").json()) == 1
    assert client.get("/api/v1/dividas").json()[0]["parcelas_restantes"] == 1
    assert client.delete(f"{base}/{bid}").status_code == 204
    assert client.get(f"/api/v1/dividas/{did}/pagamentos").json() == []
    assert client.get("/api/v1/dividas").json()[0]["parcelas_restantes"] == 2


def test_filtros_nos_relatorios_existentes(finance_client):
    client, uid, sf = finance_client
    bancos, _ = seed(sf, uid)
    cid = criar(client, "pagar", modalidade="parcelada")
    criar(client, "receber")
    client.post(f"/api/v1/contas-pagar/{cid}/baixas", json={"valor": 10, "conta_id": bancos[0]})
    hoje = date.today()
    params = {"mes": hoje.month, "ano": hoje.year, "tipo": "parcelada", "status": "parcial", "categoria": "moradia"}
    r = client.get("/api/v1/relatorio/detalhado", params=params)
    assert r.status_code == 200, r.text
    assert len(r.json()["contas_pagar"]) == 1 and r.json()["contas_receber"] == []
    assert r.json()["contas_pagar"][0]["valor_baixado"] == 10
    fluxo = client.get("/api/v1/relatorio/fluxo-caixa", params=params).json()
    assert sum(m["saidas"] for m in fluxo) == 100
    assert sum(m["entradas"] for m in fluxo) == 0
    dia = client.get("/api/v1/relatorio/contas-pagar-dia", params={"data": hoje.isoformat(), "tipo": "parcelada", "status": "parcial"}).json()
    assert len(dia["contas"]) == 1
