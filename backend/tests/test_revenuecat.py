"""Assinaturas compradas na App Store via RevenueCat."""
from app.core.config import settings


def _evento(user_id, tipo="INITIAL_PURCHASE", entitlements=("premium",), product="br.com.equili.app.premium.mensal"):
    return {
        "api_version": "1.0",
        "event": {
            "id": "evt-teste",
            "type": tipo,
            "app_user_id": str(user_id),
            "original_app_user_id": str(user_id),
            "product_id": product,
            "entitlement_ids": list(entitlements),
            "purchase_at_ms": 1767225600000,
            "expiration_at_ms": 1798761600000,
            "store": "APP_STORE",
            "environment": "SANDBOX",
        },
    }


def _webhook(client, payload, auth):
    return client.post(
        "/api/v1/assinaturas/webhook/revenuecat",
        json=payload,
        headers={"Authorization": auth},
    )


def test_webhook_revenuecat_exige_autorizacao(finance_client, monkeypatch):
    monkeypatch.setattr(settings, "REVENUECAT_WEBHOOK_AUTH", "segredo")
    client, user_id, _ = finance_client

    r = _webhook(client, _evento(user_id), "errado")
    assert r.status_code == 401, r.text


def test_webhook_revenuecat_ativa_premium(finance_client, monkeypatch):
    monkeypatch.setattr(settings, "REVENUECAT_WEBHOOK_AUTH", "segredo")
    client, user_id, _ = finance_client

    r = _webhook(client, _evento(user_id), "segredo")
    assert r.status_code == 200, r.text
    assert r.json()["plano"] == "premium"

    plano = client.get("/api/v1/planos/me").json()
    assert plano["nome"] == "premium"

    assinatura = client.get("/api/v1/assinaturas/me").json()["assinatura"]
    assert assinatura["gateway"] == "revenuecat"
    assert assinatura["status"] == "ativa"
    assert assinatura["data_proxima_cobranca"]


def test_webhook_revenuecat_aceita_bearer(finance_client, monkeypatch):
    monkeypatch.setattr(settings, "REVENUECAT_WEBHOOK_AUTH", "segredo")
    client, user_id, _ = finance_client

    r = _webhook(client, _evento(user_id, entitlements=("pro",), product="br.com.equili.app.pro.anual"), "Bearer segredo")
    assert r.status_code == 200, r.text
    assert r.json()["plano"] == "pro"
    assert client.get("/api/v1/planos/me").json()["nome"] == "pro"


def test_cancelamento_mantem_acesso_ate_expirar(finance_client, monkeypatch):
    monkeypatch.setattr(settings, "REVENUECAT_WEBHOOK_AUTH", "segredo")
    client, user_id, _ = finance_client

    assert _webhook(client, _evento(user_id), "segredo").status_code == 200
    cancelamento = _webhook(client, _evento(user_id, tipo="CANCELLATION"), "segredo")
    assert cancelamento.status_code == 200
    assert cancelamento.json()["acesso_mantido"] is True
    assert client.get("/api/v1/planos/me").json()["nome"] == "premium"


def test_expiracao_reverte_para_gratuito(finance_client, monkeypatch):
    monkeypatch.setattr(settings, "REVENUECAT_WEBHOOK_AUTH", "segredo")
    client, user_id, _ = finance_client

    assert _webhook(client, _evento(user_id), "segredo").status_code == 200
    expiracao = _webhook(client, _evento(user_id, tipo="EXPIRATION"), "segredo")
    assert expiracao.status_code == 200, expiracao.text
    assert expiracao.json()["plano"] == "gratuito"
    assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"


def test_webhook_ignora_app_user_id_invalido(finance_client, monkeypatch):
    monkeypatch.setattr(settings, "REVENUECAT_WEBHOOK_AUTH", "segredo")
    client, _, _ = finance_client

    payload = _evento("00000000-0000-0000-0000-000000000000")
    payload["event"]["app_user_id"] = "anonimo"
    r = _webhook(client, payload, "segredo")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ignored"
