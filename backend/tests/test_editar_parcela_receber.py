from datetime import date

def test_editar_parcela_persiste(finance_client):
    client, _, _ = finance_client
    r = client.post("/api/v1/contas-receber", json={"descricao": "Carne", "origem": "venda", "valor": 100, "data_prevista": date.today().isoformat(), "modalidade": "parcelada", "numero_parcelas": 3})
    assert r.status_code == 201, r.text
    p = r.json()[1]
    body = {"descricao": "Carne (2/3)", "origem": "venda", "valor": 150.5, "data_prevista": "2026-12-01", "tipo": "parcelada", "devedor": "", "observacao": ""}
    r = client.patch(f"/api/v1/contas-receber/{p['id']}", json=body)
    got = [c for c in client.get("/api/v1/contas-receber").json() if c["id"] == p["id"]][0]
    assert got["valor"] == 150.5 and got["data_prevista"] == "2026-12-01"
