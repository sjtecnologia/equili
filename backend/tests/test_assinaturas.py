"""
Cobrança e assinaturas: checkout PIX/cartão, webhook de confirmação (mock),
cancelamento e reflexo no plano do usuário.
"""
from app.core.config import settings


def _checkout(client, plano="premium", metodo="pix"):
    return client.post("/api/v1/assinaturas/checkout", json={"plano": plano, "metodo": metodo})


def _webhook_aprovado(client, gateway_ref, valor):
    return client.post(
        "/api/v1/assinaturas/webhook/mock",
        json={
            "evento": "pagamento_confirmado",
            "pagamento_id": gateway_ref,
            "aprovado": True,
            "valor": valor,
        },
        headers={"X-Equili-Mock": settings.PAYMENT_MOCK_KEY},
    )


def test_checkout_pix_cria_pagamento_pendente(finance_client):
    client, _, _ = finance_client
    r = _checkout(client)
    assert r.status_code == 201, r.text
    data = r.json()
    pagamento = data["pagamento"]
    assert pagamento["plano"] == "premium"
    assert pagamento["metodo"] == "pix"
    assert pagamento["status"] == "pendente"
    assert pagamento["valor"] == 19.90
    assert pagamento["qr_code"]
    assert pagamento["qr_base64"].startswith("data:image/svg+xml;base64,")
    assert data["simulavel"] is True
    assert data["assinatura"]["status"] == "aguardando_pagamento"
    assert data["assinatura"]["preco_mensal"] == 19.90


def test_checkout_cartao_gera_url(finance_client):
    client, _, _ = finance_client
    r = _checkout(client, metodo="cartao")
    assert r.status_code == 201, r.text
    pagamento = r.json()["pagamento"]
    assert pagamento["metodo"] == "cartao"
    assert pagamento["url_pagamento"]
    assert pagamento["qr_code"] is None


def test_checkout_presenca_antes_da_aprovacao_nao_muda_plano(finance_client):
    client, _, _ = finance_client
    _checkout(client)
    plano = client.get("/api/v1/planos/me").json()
    assert plano["nome"] == "gratuito"
    assert "investimentos" not in plano["recursos"]
    assert "nfs" not in plano["recursos"]


def test_checkout_plano_invalido_ou_metodo_invalido(finance_client):
    client, _, _ = finance_client
    assert _checkout(client, plano="gratuito").status_code == 422
    assert _checkout(client, plano="ouro").status_code == 422
    assert _checkout(client, metodo="boleto").status_code == 422


def test_webhook_confirma_pagamento_e_ativa_plano(finance_client):
    client, _, _ = finance_client
    checkout = _checkout(client, plano="premium").json()
    gateway_ref = checkout["pagamento"]["gateway_pagamento_id"]

    webhook = _webhook_aprovado(client, gateway_ref, 19.90)
    assert webhook.status_code == 200, webhook.text
    assert webhook.json()["status"] == "ok"

    # Pagamento e assinatura atualizados
    me = client.get("/api/v1/assinaturas/me").json()
    assert me["assinatura"] is not None
    assert me["assinatura"]["status"] == "ativa"
    assert me["assinatura"]["plano"] == "premium"
    assert me["assinatura"]["data_proxima_cobranca"]
    assert me["pagamentos"][0]["status"] == "pago"
    assert me["pagamentos"][0]["pago_em"]

    # Plano liberado no catálogo
    plano = client.get("/api/v1/planos/me").json()
    assert plano["nome"] == "premium"
    assert plano["rotulo"] == "Premium"
    assert "investimentos" in plano["recursos"]
    assert "nfs" not in plano["recursos"]


def test_webhook_duplicado_nao_repere_ativacao(finance_client):
    client, _, _ = finance_client
    gateway_ref = _checkout(client).json()["pagamento"]["gateway_pagamento_id"]
    assert _webhook_aprovado(client, gateway_ref, 19.90).status_code == 200
    segundo = _webhook_aprovado(client, gateway_ref, 19.90)
    assert segundo.status_code == 200
    assert segundo.json().get("duplicado") is True


def test_webhook_pix_com_chave_invalida_401(finance_client):
    client, _, _ = finance_client
    gateway_ref = _checkout(client).json()["pagamento"]["gateway_pagamento_id"]
    r = client.post(
        "/api/v1/assinaturas/webhook/mock",
        json={"evento": "pagamento_confirmado", "pagamento_id": gateway_ref, "aprovado": True},
        headers={"X-Equili-Mock": "chave-errada"},
    )
    assert r.status_code == 401, r.text
    assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"
    assert client.get("/api/v1/assinaturas/me").json()["assinatura"] is None


def test_webhook_pagamento_recusado_nao_altera_plano(finance_client):
    client, _, _ = finance_client
    gateway_ref = _checkout(client).json()["pagamento"]["gateway_pagamento_id"]
    r = client.post(
        "/api/v1/assinaturas/webhook/mock",
        json={"evento": "pagamento_recusado", "pagamento_id": gateway_ref},
        headers={"X-Equili-Mock": settings.PAYMENT_MOCK_KEY},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "recusado"
    pagamentos = client.get("/api/v1/assinaturas/me").json()["pagamentos"]
    assert pagamentos[0]["status"] == "recusado"
    assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"


def test_checkout_duplicado_mesmo_plano_409_apos_ativacao(finance_client):
    client, _, _ = finance_client
    gateway_ref = _checkout(client).json()["pagamento"]["gateway_pagamento_id"]
    _webhook_aprovado(client, gateway_ref, 19.90)
    r = _checkout(client, plano="premium")
    assert r.status_code == 409, r.text


def test_upgrade_premium_para_pro(finance_client):
    client, _, _ = finance_client
    ref_premium = _checkout(client, plano="premium").json()["pagamento"]["gateway_pagamento_id"]
    _webhook_aprovado(client, ref_premium, 19.90)

    # Upgrade para Pro fecha nova assinatura e paga
    checkout_pro = _checkout(client, plano="pro", metodo="cartao").json()
    assert checkout_pro["pagamento"]["valor"] == 34.90
    _webhook_aprovado(client, checkout_pro["pagamento"]["gateway_pagamento_id"], 34.90)

    me = client.get("/api/v1/assinaturas/me").json()
    assert me["assinatura"]["plano"] == "pro"
    assert client.get("/api/v1/planos/me").json()["nome"] == "pro"


def test_cancelar_assinatura_reverte_para_gratuito(finance_client):
    client, _, _ = finance_client
    gateway_ref = _checkout(client).json()["pagamento"]["gateway_pagamento_id"]
    _webhook_aprovado(client, gateway_ref, 19.90)
    assert client.get("/api/v1/planos/me").json()["nome"] == "premium"

    r = client.post("/api/v1/assinaturas/cancelar")
    assert r.status_code == 200, r.text
    assert r.json()["assinatura"]["status"] == "cancelada"
    assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"
    assert client.get("/api/v1/assinaturas/me").json()["assinatura"] is None

    # Cancelar de novo sem assinatura ativa -> 409
    assert client.post("/api/v1/assinaturas/cancelar").status_code == 409


def test_webhook_pagamento_desconhecido_404(finance_client):
    client, _, _ = finance_client
    r = client.post(
        "/api/v1/assinaturas/webhook/mock",
        json={"evento": "pagamento_confirmado", "pagamento_id": "nao-existe", "aprovado": True},
        headers={"X-Equili-Mock": settings.PAYMENT_MOCK_KEY},
    )
    assert r.status_code == 404, r.text