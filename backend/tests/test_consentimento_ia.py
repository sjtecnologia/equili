"""Consentimento explícito de IA (Apple 5.1.1/5.1.2 e LGPD)."""
import asyncio

from app.models.usuario import Usuario


def _sem_consentimento(session_factory, user_id):
    async def run():
        async with session_factory() as s:
            usuario = await s.get(Usuario, user_id)
            usuario.consentimento_ia_em = None
            usuario.consentimento_ia_versao = None
            await s.commit()

    asyncio.run(run())


def test_me_expoe_status_de_consentimento(finance_client):
    client, _, _ = finance_client
    data = client.get("/api/v1/usuarios/me").json()
    assert data["consentimento_ia_em"]
    assert data["consentimento_ia_versao"] == "teste"


def test_revogar_consentimento_bloqueia_chat_com_428(finance_client):
    client, user_id, sf = finance_client
    _sem_consentimento(sf, user_id)

    r = client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "Oi"}]})
    assert r.status_code == 428, r.text
    assert r.headers.get("X-Equili-Consentimento-IA") == "necessario"


def test_aceitar_consentimento_libera_recursos_de_ia(finance_client):
    client, user_id, sf = finance_client
    _sem_consentimento(sf, user_id)

    r = client.post(
        "/api/v1/usuarios/me/consentimento-ia",
        json={"aceito": True, "versao": "2026-11-01"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["consentimento_ia_em"]
    assert r.json()["consentimento_ia_versao"] == "2026-11-01"

    # O chat deixa de ser bloqueado pelo consentimento (pode falhar por falta
    # de OPENROUTER_API_KEY, mas não com 428).
    chat = client.post(
        "/api/v1/chat",
        json={"messages": [{"role": "user", "content": "Oi"}]},
    )
    assert chat.status_code != 428


def test_revogar_consentimento_limpa_campos(finance_client):
    client, _, _ = finance_client
    r = client.post(
        "/api/v1/usuarios/me/consentimento-ia",
        json={"aceito": False},
    )
    assert r.status_code == 200, r.text
    assert r.json()["consentimento_ia_em"] is None
    assert r.json()["consentimento_ia_versao"] is None
