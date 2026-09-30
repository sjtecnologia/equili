from __future__ import annotations


def test_criar_cartao_sem_limite_atual_herda_limite_total(finance_client):
    client, _, _ = finance_client

    response = client.post(
        "/api/v1/cartoes-credito",
        json={
            "nome": "Nubank",
            "bandeira": "mastercard",
            "limite": 1000.0,
            "dia_fechamento": 5,
            "dia_vencimento": 12,
        },
    )

    assert response.status_code == 201, response.text
    cartao = response.json()
    assert float(cartao["limite_atual"]) == 1000.0


def test_criar_cartao_com_limite_atual_informado(finance_client):
    client, _, _ = finance_client

    response = client.post(
        "/api/v1/cartoes-credito",
        json={
            "nome": "Inter",
            "bandeira": "visa",
            "limite": 2000.0,
            "limite_atual": 500.0,
            "dia_fechamento": 10,
            "dia_vencimento": 20,
        },
    )

    assert response.status_code == 201, response.text
    cartao = response.json()
    assert float(cartao["limite_atual"]) == 500.0


def test_limite_atual_nao_pode_exceder_limite_total(finance_client):
    client, _, _ = finance_client

    response = client.post(
        "/api/v1/cartoes-credito",
        json={
            "nome": "Santander",
            "bandeira": "elo",
            "limite": 500.0,
            "limite_atual": 800.0,
            "dia_fechamento": 1,
            "dia_vencimento": 10,
        },
    )

    assert response.status_code == 422, response.text


def _criar_cartao(client, limite=1000.0):
    response = client.post(
        "/api/v1/cartoes-credito",
        json={
            "nome": "Cartão Teste",
            "bandeira": "visa",
            "limite": limite,
            "dia_fechamento": 5,
            "dia_vencimento": 15,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_criar_lancamento_compra_decrementa_limite_atual(finance_client):
    client, _, _ = finance_client
    cartao_id = _criar_cartao(client)

    response = client.post(
        f"/api/v1/cartoes-credito/{cartao_id}/lancamentos",
        json={"descricao": "Compra mercado", "valor": 300.0, "tipo": "compra", "data": "2025-01-10"},
    )
    assert response.status_code == 201, response.text

    lancamentos = client.get(f"/api/v1/cartoes-credito/{cartao_id}/lancamentos").json()
    assert lancamentos["limite_atual"] == 700.0
    assert lancamentos["limite_usado"] == 300.0


def test_excluir_lancamento_devolve_limite_atual(finance_client):
    client, _, _ = finance_client
    cartao_id = _criar_cartao(client)

    criado = client.post(
        f"/api/v1/cartoes-credito/{cartao_id}/lancamentos",
        json={"descricao": "Compra roupa", "valor": 250.0, "tipo": "compra", "data": "2025-01-10"},
    ).json()

    apos_compra = client.get(f"/api/v1/cartoes-credito/{cartao_id}/lancamentos").json()
    assert apos_compra["limite_atual"] == 750.0

    del_response = client.delete(f"/api/v1/cartoes-credito/{cartao_id}/lancamentos/{criado['id']}")
    assert del_response.status_code == 204

    apos_exclusao = client.get(f"/api/v1/cartoes-credito/{cartao_id}/lancamentos").json()
    assert apos_exclusao["limite_atual"] == 1000.0


def test_pagar_fatura_incrementa_limite_atual_ate_o_total(finance_client):
    client, _, _ = finance_client
    cartao_id = _criar_cartao(client)

    client.post(
        f"/api/v1/cartoes-credito/{cartao_id}/lancamentos",
        json={"descricao": "Compra viagem", "valor": 600.0, "tipo": "compra", "data": "2025-01-05"},
    )

    pagamento = client.post(
        f"/api/v1/cartoes-credito/{cartao_id}/lancamentos",
        json={"descricao": "Pagamento de fatura", "valor": 900.0, "tipo": "pagamento", "data": "2025-01-20"},
    )
    assert pagamento.status_code == 201, pagamento.text

    lancamentos = client.get(f"/api/v1/cartoes-credito/{cartao_id}/lancamentos").json()
    # 1000 - 600 + 900 = 1300, mas nao pode exceder o limite total (1000)
    assert lancamentos["limite_atual"] == 1000.0
