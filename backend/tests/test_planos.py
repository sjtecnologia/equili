"""
Sistema de planos e assinaturas:
catálogo, consulta de entitlements e gating por plano.
"""
import asyncio

from app.models.usuario import Usuario


def test_catalogo_publico_retorna_3_planos(finance_client):
    client, _, _ = finance_client
    r = client.get("/api/v1/planos")
    assert r.status_code == 200, r.text
    planos = r.json()["planos"]
    assert [p["nome"] for p in planos] == ["gratuito", "premium", "pro"]
    by_name = {p["nome"]: p for p in planos}
    assert by_name["gratuito"]["preco_mensal"] == 0.0
    assert by_name["premium"]["preco_mensal"] == 19.90
    assert by_name["pro"]["preco_mensal"] == 34.90
    assert "investimentos" in by_name["premium"]["recursos"]
    assert "nfs" in by_name["pro"]["recursos"]
    assert by_name["gratuito"]["recursos"] == []


def test_meu_plano_retorna_entitlements_do_gratuito(finance_client):
    client, _, _ = finance_client
    r = client.get("/api/v1/planos/me")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["nome"] == "gratuito"
    assert data["limites"]["dividas_ativas"] == 3
    assert data["limites"]["chat_msgs_mes"] == 15
    assert "uso" in data and data["uso"]["chat_msgs_mes"] == 0


def test_gratuito_nao_tem_acesso_a_investimentos(finance_client):
    client, _, _ = finance_client
    r = client.get("/api/v1/investimentos")
    assert r.status_code == 402, r.text


def test_gratuito_nao_tem_acesso_a_contas_bancarias(finance_client):
    client, _, _ = finance_client
    r = client.get("/api/v1/contas-bancarias")
    assert r.status_code == 402, r.text


def test_gratuito_nao_tem_acesso_a_nfs(finance_client):
    client, _, _ = finance_client
    r = client.get("/api/v1/nfs")
    assert r.status_code == 402, r.text


def test_gratuito_nao_tem_acesso_ao_assistente_de_voz(finance_client):
    client, _, _ = finance_client
    r = client.post("/api/v1/voz/comando", json={"transcricao": "ver resumo"})
    assert r.status_code == 402, r.text


def test_gratuito_nao_tem_acesso_ao_relatorio_detalhado(finance_client):
    client, _, _ = finance_client
    from datetime import date
    hoje = date.today()
    r = client.get(
        "/api/v1/relatorio/detalhado",
        params={"mes": hoje.month, "ano": hoje.year},
    )
    assert r.status_code == 402, r.text


def test_plano_gratuito_limita_um_cartao(finance_client):
    client, _, _ = finance_client
    criar = lambda: client.post(
        "/api/v1/cartoes-credito",
        json={
            "nome": "Cartão",
            "bandeira": "visa",
            "limite": 1000.0,
            "dia_fechamento": 5,
            "dia_vencimento": 12,
        },
    )
    assert criar().status_code == 201
    segundo = criar()
    assert segundo.status_code == 429, segundo.text
    assert "limite" in segundo.json()["detail"].lower()


def test_upgrade_para_premium_libera_investimentos(finance_client):
    client, user_id, sf = finance_client

    async def upgrade():
        async with sf() as s:
            u = await s.get(Usuario, user_id)
            u.plano = "premium"
            await s.commit()

    asyncio.run(upgrade())

    assert client.get("/api/v1/investimentos").status_code == 200
    assert client.get("/api/v1/contas-bancarias").status_code == 200
    # NFS continua restrita ao plano Pro
    assert client.get("/api/v1/nfs").status_code == 402


def test_upgrade_para_pro_libera_nfs(finance_client):
    client, user_id, sf = finance_client

    async def upgrade():
        async with sf() as s:
            u = await s.get(Usuario, user_id)
            u.plano = "pro"
            await s.commit()

    asyncio.run(upgrade())

    assert client.get("/api/v1/nfs").status_code == 200
    assert client.get("/api/v1/investimentos").status_code == 200


def test_limite_de_divisas_usa_status_429_e_nao_desloga(finance_client):
    """Cota de volume deve responder 429 (e não 403/401) para o app não deslogar."""
    client, user_id, sf = finance_client

    async def seed():
        async with sf() as s:
            from datetime import date, timedelta
            from app.models.divida import Divida
            base = date.today() + timedelta(days=1)
            for i in range(3):
                s.add(
                    Divida(
                        usuario_id=user_id, descricao=f"D{i}", credor="B", tipo="emprestimo",
                        valor_total=1000, valor_parcela=200, parcelas_totais=5,
                        parcelas_restantes=5, data_prox_vencimento=base,
                    )
                )
            await s.commit()

    asyncio.run(seed())

    r = client.post(
        "/api/v1/dividas",
        json={
            "descricao": "Extra", "credor": "B", "tipo": "emprestimo",
            "valor_total": 2000, "valor_parcela": 400, "parcelas_totais": 5,
            "parcelas_restantes": 5, "data_prox_vencimento": "2099-01-01",
        },
    )
    assert r.status_code == 429, r.text