"""
Rotas de metas financeiras: CRUD, aportes, progresso e limite por plano.
"""
import asyncio
from datetime import date, timedelta

from app.models.usuario import Usuario


def _payload(**over):
    base = {"titulo": "Reserva de emergência", "valor_alvo": 5000.0}
    base.update(over)
    return base


def test_criar_e_listar_meta(finance_client):
    client, _, _ = finance_client
    r = client.post("/api/v1/metas", json=_payload(prazo="2027-12-31"))
    assert r.status_code == 201, r.text
    meta = r.json()
    assert meta["titulo"] == "Reserva de emergência"
    assert meta["valor_alvo"] == 5000.0
    assert meta["valor_atual"] == 0.0
    assert meta["progresso"] == 0.0
    assert meta["prazo"] == "2027-12-31"

    lista = client.get("/api/v1/metas").json()
    assert lista["total"] == 1 and lista["ativas"] == 1
    assert lista["metas"][0]["id"] == meta["id"]


def test_plano_gratuito_limita_uma_meta_ativa_com_429(finance_client):
    client, _, _ = finance_client
    assert client.post("/api/v1/metas", json=_payload()).status_code == 201
    segundo = client.post("/api/v1/metas", json=_payload(titulo="Viagem"))
    assert segundo.status_code == 429, segundo.text
    assert "limite" in segundo.json()["detail"].lower()

    # Concluir a meta libera o limite para criá-la de novo
    meta_id = client.get("/api/v1/metas").json()["metas"][0]["id"]
    assert client.patch(f"/api/v1/metas/{meta_id}", json={"concluida": True}).status_code == 200
    novo = client.post("/api/v1/metas", json=_payload(titulo="Viagem"))
    assert novo.status_code == 201, novo.text


def test_premium_tem_metas_ilimitadas(finance_client):
    client, user_id, sf = finance_client

    async def upgrade():
        async with sf() as s:
            u = await s.get(Usuario, user_id)
            u.plano = "premium"
            await s.commit()

    asyncio.run(upgrade())

    for i in range(5):
        r = client.post("/api/v1/metas", json=_payload(titulo=f"Meta {i}"))
        assert r.status_code == 201, r.text
    assert client.get("/api/v1/metas").json()["total"] == 5


def test_atualizar_meta_reabre_e_conclui_automaticamente(finance_client):
    client, _, _ = finance_client
    meta_id = client.post(
        "/api/v1/metas", json=_payload(valor_atual=3000.0, valor_alvo=5000.0)
    ).json()["id"]

    # Ampliar o alvo além do atual mantém em aberto
    r = client.patch(f"/api/v1/metas/{meta_id}", json={"titulo": "Fundo reserva", "valor_alvo": 9000.0})
    assert r.status_code == 200, r.text
    assert r.json()["titulo"] == "Fundo reserva"
    assert r.json()["concluida"] is False
    assert r.json()["percentual"] == round(3000 / 9000 * 100, 1)

    # Reduzir o alvo para abaixo do valor atual conclui automaticamente
    r = client.patch(f"/api/v1/metas/{meta_id}", json={"valor_alvo": 1000.0})
    assert r.json()["concluida"] is True


def test_aportar_incrementa_progresso_e_conclui(finance_client):
    client, _, _ = finance_client
    meta_id = client.post(
        "/api/v1/metas", json=_payload(valor_atual=100.0, valor_alvo=1000.0)
    ).json()["id"]

    r = client.post(f"/api/v1/metas/{meta_id}/aportar", json={"valor": 400.0})
    assert r.status_code == 200, r.text
    assert r.json()["valor_atual"] == 500.0
    assert r.json()["progresso"] == 0.5
    assert r.json()["concluida"] is False

    r = client.post(f"/api/v1/metas/{meta_id}/aportar", json={"valor": 600.0})
    assert r.json()["valor_atual"] == 1100.0
    assert r.json()["concluida"] is True
    assert r.json()["restante"] == 0.0

    invalido = client.post(f"/api/v1/metas/{meta_id}/aportar", json={"valor": 0})
    assert invalido.status_code == 422


def test_apagar_meta(finance_client):
    client, _, _ = finance_client
    meta_id = client.post("/api/v1/metas", json=_payload()).json()["id"]
    assert client.delete(f"/api/v1/metas/{meta_id}").status_code == 204
    assert client.get("/api/v1/metas").json()["total"] == 0
    assert client.get(f"/api/v1/metas/{meta_id}").status_code == 404


def test_meta_inexistente_retorna_404(finance_client):
    client, _, _ = finance_client
    import uuid
    assert client.get(f"/api/v1/metas/{uuid.uuid4()}").status_code == 404
    assert client.patch(
        f"/api/v1/metas/{uuid.uuid4()}", json={"titulo": "X"}
    ).status_code == 404
    assert client.post(
        f"/api/v1/metas/{uuid.uuid4()}/aportar", json={"valor": 10}
    ).status_code == 404


def test_meta_nao_valida_titulo_ou_valor(finance_client):
    client, _, _ = finance_client
    assert client.post("/api/v1/metas", json=_payload(titulo="   ")).status_code == 422
    assert client.post("/api/v1/metas", json=_payload(valor_alvo=0)).status_code == 422
    assert client.post("/api/v1/metas", json=_payload(valor_alvo=100, valor_atual=-5)).status_code == 422


def test_uso_de_metas_no_meu_plano(finance_client):
    client, _, _ = finance_client
    assert client.post("/api/v1/metas", json=_payload()).status_code == 201
    r = client.get("/api/v1/planos/me").json()
    assert r["uso"]["metas_ativas"] == 1