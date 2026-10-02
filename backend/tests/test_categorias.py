from __future__ import annotations


def _criar(client, **kw):
    payload = {"nome": "Mercado", "tipo": "despesa", **kw}
    return client.post("/api/v1/categorias", json=payload)


def test_crud_categoria(finance_client):
    client, _, _ = finance_client

    r = _criar(client, cor="#FF0000")
    assert r.status_code == 201, r.text
    cat = r.json()
    assert cat["ativo"] is True and cat["cor"] == "#FF0000"

    assert client.get(f"/api/v1/categorias/{cat['id']}").status_code == 200

    r = client.put(f"/api/v1/categorias/{cat['id']}", json={"ativo": False})
    assert r.status_code == 200 and r.json()["ativo"] is False and r.json()["nome"] == "Mercado"

    assert client.get("/api/v1/categorias", params={"ativo": "true"}).json() == []
    assert len(client.get("/api/v1/categorias", params={"tipo": "despesa"}).json()) == 1
    assert client.get("/api/v1/categorias", params={"tipo": "receita"}).json() == []

    assert client.delete(f"/api/v1/categorias/{cat['id']}").status_code == 204
    assert client.get(f"/api/v1/categorias/{cat['id']}").status_code == 404


def test_validacoes_e_duplicidade(finance_client):
    client, _, _ = finance_client

    assert _criar(client, nome="   ").status_code == 422
    assert _criar(client, tipo="outro").status_code == 422
    assert _criar(client).status_code == 201
    assert _criar(client).status_code == 409
    assert _criar(client, tipo="receita").status_code == 201


def test_excluir_categoria_em_uso_retorna_409(finance_client):
    client, _, _ = finance_client

    cat = _criar(client, nome="moradia").json()
    r = client.post(
        "/api/v1/contas-pagar",
        json={"descricao": "Aluguel", "categoria": "moradia", "valor": 100, "data_vencimento": "2026-10-10"},
    )
    assert r.status_code == 201, r.text

    r = client.delete(f"/api/v1/categorias/{cat['id']}")
    assert r.status_code == 409


def test_conta_categoria_livre_vazia_e_filtro_case_insensitive(finance_client):
    client, _, _ = finance_client
    base = {"valor": 10, "data_vencimento": "2026-10-10"}

    assert client.post("/api/v1/contas-pagar", json={**base, "descricao": "A", "categoria": " Pets "}).status_code == 201
    assert client.post("/api/v1/contas-pagar", json={**base, "descricao": "B", "categoria": "pets"}).status_code == 201
    r = client.post("/api/v1/contas-pagar", json={**base, "descricao": "C"})
    assert r.status_code == 201 and r.json()[0]["categoria"] == ""

    achadas = client.get("/api/v1/contas-pagar", params={"categoria": "PETS"}).json()
    assert {c["descricao"] for c in achadas} == {"A", "B"}
    assert len(client.get("/api/v1/contas-pagar", params={"categoria": ""}).json()) == 3

    r = client.post(
        "/api/v1/contas-receber",
        json={"descricao": "R", "valor": 5, "data_prevista": "2026-10-10", "origem": "Bônus"},
    )
    assert r.status_code == 201, r.text
    assert len(client.get("/api/v1/contas-receber", params={"categoria": "bônus"}).json()) == 1


def test_categoria_nasce_ativa_e_filtro_ativo(finance_client):
    client, _, _ = finance_client

    nova = _criar(client, nome="Pets").json()
    assert nova["ativo"] is True

    inativa = _criar(client, nome="Velha", ativo=False).json()
    assert inativa["ativo"] is False

    nomes = {c["nome"] for c in client.get("/api/v1/categorias", params={"tipo": "despesa", "ativo": "true"}).json()}
    assert nomes == {"Pets"}
