from __future__ import annotations

import asyncio
from datetime import date

from sqlalchemy import select

from app.models.conta_bancaria import CartaoCredito, ContaBancaria
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.lancamento_cartao import LancamentoCartao
from app.models.lancamento_conta import LancamentoConta


def _seed(session_factory, user_id):
    async def run():
        async with session_factory() as s:
            conta = ContaBancaria(usuario_id=user_id, nome="CC", banco="B", tipo="corrente", saldo_inicial=100.0)
            cartao = CartaoCredito(
                usuario_id=user_id, nome="Cartao", bandeira="visa", limite=1000.0, limite_atual=1000.0,
                dia_fechamento=5, dia_vencimento=12,
            )
            s.add_all([conta, cartao])
            await s.commit()
            return conta.id, cartao.id

    return asyncio.run(run())


def _criar_receber(client):
    r = client.post(
        "/api/v1/contas-receber",
        json={"descricao": "Freela", "origem": "freela", "valor": 250.0, "data_prevista": date.today().isoformat()},
    )
    assert r.status_code == 201, r.text
    return r.json()[0]["id"]


def _criar_pagar(client):
    r = client.post(
        "/api/v1/contas-pagar",
        json={"descricao": "Luz", "categoria": "moradia", "valor": 40.0, "data_vencimento": date.today().isoformat()},
    )
    assert r.status_code == 201, r.text
    return r.json()[0]["id"]


def _saldo(client, conta_id):
    r = client.get(f"/api/v1/contas-bancarias/{conta_id}/lancamentos")
    assert r.status_code == 200, r.text
    return r.json()["saldo_atual"]


def _lancamentos(session_factory, model):
    async def run():
        async with session_factory() as s:
            return (await s.execute(select(model))).scalars().all()

    return asyncio.run(run())


def test_receber_via_conta_incrementa_saldo_e_cria_lancamento(finance_client):
    client, user_id, sf = finance_client
    conta_id, _ = _seed(sf, user_id)
    cid = _criar_receber(client)

    r = client.patch(
        f"/api/v1/contas-receber/{cid}/receber",
        json={"meio_recebimento": "conta", "conta_id": str(conta_id), "data_recebimento": "2026-10-01"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "recebido"
    assert body["meio_recebimento"] == "conta"
    assert body["conta_id"] == str(conta_id)
    assert body["data_recebimento"] == "2026-10-01"

    assert _saldo(client, conta_id) == 350.0
    lanc = _lancamentos(sf, LancamentoConta)
    assert len(lanc) == 1 and lanc[0].tipo == "entrada" and float(lanc[0].valor) == 250.0


def test_receber_via_dinheiro_nao_movimenta_saldo(finance_client):
    client, user_id, sf = finance_client
    conta_id, _ = _seed(sf, user_id)
    cid = _criar_receber(client)

    r = client.patch(
        f"/api/v1/contas-receber/{cid}/receber",
        json={"meio_recebimento": "dinheiro", "conta_id": str(conta_id)},
    )
    assert r.status_code == 200, r.text
    assert r.json()["meio_recebimento"] == "dinheiro"
    assert r.json()["data_recebimento"] == date.today().isoformat()
    assert _saldo(client, conta_id) == 100.0
    assert _lancamentos(sf, LancamentoConta) == []


def test_receber_sem_corpo_assume_dinheiro(finance_client):
    client, _, sf = finance_client
    cid = _criar_receber(client)

    r = client.patch(f"/api/v1/contas-receber/{cid}/receber")
    assert r.status_code == 200, r.text
    assert r.json()["meio_recebimento"] == "dinheiro"
    assert _lancamentos(sf, LancamentoConta) == []


def test_pagar_via_conta_decrementa_saldo(finance_client):
    client, user_id, sf = finance_client
    conta_id, _ = _seed(sf, user_id)
    cid = _criar_pagar(client)

    r = client.patch(f"/api/v1/contas-pagar/{cid}/pagar", json={"conta_id": str(conta_id)})
    assert r.status_code == 200, r.text
    assert r.json()["conta_id"] == str(conta_id)
    assert _saldo(client, conta_id) == 60.0
    lanc = _lancamentos(sf, LancamentoConta)
    assert len(lanc) == 1 and lanc[0].tipo == "saida"


def test_pagar_via_cartao_ajusta_limite(finance_client):
    client, user_id, sf = finance_client
    _, cartao_id = _seed(sf, user_id)
    cid = _criar_pagar(client)

    r = client.patch(f"/api/v1/contas-pagar/{cid}/pagar", json={"cartao_id": str(cartao_id)})
    assert r.status_code == 200, r.text
    assert r.json()["cartao_id"] == str(cartao_id)

    async def limite():
        async with sf() as s:
            return float((await s.get(CartaoCredito, cartao_id)).limite_atual)

    assert asyncio.run(limite()) == 960.0
    lanc = _lancamentos(sf, LancamentoCartao)
    assert len(lanc) == 1 and lanc[0].tipo == "compra"


def test_baixa_idempotente_retorna_409_sem_duplicar(finance_client):
    client, user_id, sf = finance_client
    conta_id, cartao_id = _seed(sf, user_id)

    rid = _criar_receber(client)
    corpo = {"meio_recebimento": "conta", "conta_id": str(conta_id)}
    assert client.patch(f"/api/v1/contas-receber/{rid}/receber", json=corpo).status_code == 200
    assert client.patch(f"/api/v1/contas-receber/{rid}/receber", json=corpo).status_code == 409

    pid = _criar_pagar(client)
    assert client.patch(f"/api/v1/contas-pagar/{pid}/pagar", json={"conta_id": str(conta_id)}).status_code == 200
    assert client.patch(f"/api/v1/contas-pagar/{pid}/pagar", json={"conta_id": str(conta_id)}).status_code == 409

    pid2 = _criar_pagar(client)
    assert client.patch(f"/api/v1/contas-pagar/{pid2}/pagar", json={"cartao_id": str(cartao_id)}).status_code == 200
    assert client.patch(f"/api/v1/contas-pagar/{pid2}/pagar", json={"cartao_id": str(cartao_id)}).status_code == 409

    assert _saldo(client, conta_id) == 100.0 + 250.0 - 40.0
    assert len(_lancamentos(sf, LancamentoConta)) == 2

    async def limite():
        async with sf() as s:
            return float((await s.get(CartaoCredito, cartao_id)).limite_atual)

    assert asyncio.run(limite()) == 960.0
    assert len(_lancamentos(sf, LancamentoCartao)) == 1


def test_listagens_expoem_novos_campos(finance_client):
    client, _, _ = finance_client
    _criar_receber(client)
    _criar_pagar(client)
    rec = client.get("/api/v1/contas-receber").json()[0]
    pag = client.get("/api/v1/contas-pagar").json()[0]
    assert {"data_recebimento", "meio_recebimento", "conta_id"} <= rec.keys()
    assert {"conta_id", "cartao_id"} <= pag.keys()


def test_listagem_contas_bancarias_traz_saldo_atual(finance_client):
    client, user_id, sf = finance_client
    conta_id, _ = _seed(sf, user_id)

    antes = client.get("/api/v1/contas-bancarias").json()[0]
    assert antes["saldo_atual"] == 100.0 and antes["saldo_inicial"] == 100.0

    cid = _criar_receber(client)
    client.patch(f"/api/v1/contas-receber/{cid}/receber", json={"meio_recebimento": "conta", "conta_id": str(conta_id)})
    pid = _criar_pagar(client)
    client.patch(f"/api/v1/contas-pagar/{pid}/pagar", json={"conta_id": str(conta_id)})

    depois = client.get("/api/v1/contas-bancarias").json()[0]
    assert depois["saldo_atual"] == 100.0 + 250.0 - 40.0
    assert depois["saldo_atual"] == _saldo(client, conta_id)
    assert depois["saldo_inicial"] == 100.0
