"""
Família / multi-usuário: convites do titular Pro, aceite com token, plano dos
membros espelha a assinatura do titular e dados são isolados por usuário.
"""
import asyncio
from contextlib import contextmanager

from app.core import dependencies as dependencies_module
from app.core.config import settings
from app.main import app
from app.models.usuario import Usuario

PAYMENT_KEY = settings.PAYMENT_MOCK_KEY


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _uparar_para_pro(client):
    checkout = client.post(
        "/api/v1/assinaturas/checkout", json={"plano": "pro", "metodo": "pix"}
    ).json()
    ref = checkout["pagamento"]["gateway_pagamento_id"]
    r = client.post(
        "/api/v1/assinaturas/webhook/mock",
        json={"evento": "pagamento_confirmado", "pagamento_id": ref, "aprovado": True, "valor": 34.90},
        headers={"X-Equili-Mock": PAYMENT_KEY},
    )
    assert r.status_code == 200, r.text
    return checkout["assinatura"]


def _criar_usuario(session_factory, nome, email, plano="gratuito"):
    async def run():
        async with session_factory() as session:
            usr = Usuario(
                nome=nome,
                email=email,
                senha_hash="hashed-password",
                plano=plano,
                email_verificado=True,
                ativo=True,
            )
            session.add(usr)
            await session.commit()
            await session.refresh(usr)
            return usr

    return asyncio.run(run())


@contextmanager
def _logado_como(user_id):
    previous = app.dependency_overrides.get(dependencies_module.get_current_user_id)
    app.dependency_overrides[dependencies_module.get_current_user_id] = lambda: user_id
    try:
        yield
    finally:
        if previous is not None:
            app.dependency_overrides[dependencies_module.get_current_user_id] = previous
        else:
            app.dependency_overrides.pop(dependencies_module.get_current_user_id, None)


def _convidar(client, email):
    return client.post("/api/v1/familia/convites", json={"email": email})


def _criar_e_aceitar(client, session_factory, email):
    """Titular convida e o usuário novo aceita; devolve (membro_id, thread)."""
    token = _convidar(client, email).json()["convite"]["token"]
    membro = _criar_usuario(session_factory, "Membro", email)
    with _logado_como(membro.id):
        assert client.post("/api/v1/familia/aceitar", json={"token": token}).status_code == 200
    return membro


# ─── Tests ───────────────────────────────────────────────────────────────────


def test_convidar_sem_pro_retorna_402(finance_client):
    client, _, _ = finance_client
    r = _convidar(client, "alguem@example.com")
    assert r.status_code == 402, r.text


def test_convidar_titular_pro_fluxo_completo(finance_client):
    client, _, session_factory = finance_client
    _uparar_para_pro(client)

    convite = _convidar(client, "membro@example.com")
    assert convite.status_code == 201, convite.text
    data = convite.json()
    assert data["convite"]["status"] == "pendente"
    assert data["convite"]["token"]
    assert data["limite_membros"] == 6

    contexto = client.get("/api/v1/familia").json()
    assert contexto["papel"] == "titular"
    assert len(contexto["convites"]) == 1

    membro = _criar_usuario(session_factory, "Membro", "membro@example.com")
    with _logado_como(membro.id):
        visao = client.get("/api/v1/familia").json()
        assert visao["papel"] == "convidado"
        assert visao["titular"]["nome"] == "Usuário Financeiro"

        r = client.post("/api/v1/familia/aceitar", json={"token": data["convite"]["token"]})
        assert r.status_code == 200, r.text

        assert client.get("/api/v1/planos/me").json()["nome"] == "pro"
        assert client.get("/api/v1/familia").json()["papel"] == "membro"

    # Titular vê 1 membro ativo.
    contexto = client.get("/api/v1/familia").json()
    assert contexto["papel"] == "titular"
    assert len(contexto["membros"]) == 1
    assert contexto["membros"][0]["email"] == "membro@example.com"


def test_dados_isolados_entre_titular_e_membro(finance_client):
    client, titular_id, session_factory = finance_client
    _uparar_para_pro(client)
    _criar_e_aceitar(client, session_factory, "membro@example.com")

    # Membro cria uma meta (Pro = ilimitado) — dados próprios dele.
    with _logado_como(titular_id):
        assert client.post(
            "/api/v1/metas", json={"titulo": "Meta do titular", "valor_alvo": 2000.0}
        ).status_code in (201, 200)

    # Buscar o id do membro para as requisições como membro
    import sqlalchemy as sa
    from sqlalchemy import select

    async def buscar_membro_id():
        async with session_factory() as session:
            usr = await session.scalar(select(Usuario).where(Usuario.email == "membro@example.com"))
            return usr.id

    membro_id = asyncio.run(buscar_membro_id())

    with _logado_como(membro_id):
        metas = client.get("/api/v1/metas").json()
        assert metas["total"] == 0  # não vê a meta do titular
        meta_membro = client.post(
            "/api/v1/metas", json={"titulo": "Meta do membro", "valor_alvo": 1000.0}
        )
        assert meta_membro.status_code in (201, 200)

    with _logado_como(titular_id):
        metas = client.get("/api/v1/metas").json()
        assert metas["total"] == 1  # vê só a própria


def test_membro_nao_pode_convidar(finance_client):
    client, _, session_factory = finance_client
    _uparar_para_pro(client)
    _criar_e_aceitar(client, session_factory, "membro@example.com")

    assert client.get("/api/v1/familia").json()["papel"] == "titular"
    # Troca para o membro: mesmo com plano Pro, não pode convidar.
    import sqlalchemy as sa
    from sqlalchemy import select

    async def buscar_membro_id():
        async with session_factory() as session:
            usr = await session.scalar(select(Usuario).where(Usuario.email == "membro@example.com"))
            return usr.id

    membro_id = asyncio.run(buscar_membro_id())
    with _logado_como(membro_id):
        r = _convidar(client, "outro@example.com")
        assert r.status_code == 409, r.text


def test_convidar_a_si_mesmo_400(finance_client):
    client, user_id, _ = finance_client
    _uparar_para_pro(client)
    r = _convidar(client, f"finance-{user_id}@example.com")
    assert r.status_code == 400, r.text


def test_convite_duplicado_409(finance_client):
    client, _, _ = finance_client
    _uparar_para_pro(client)
    assert _convidar(client, "dup@example.com").status_code == 201
    assert _convidar(client, "dup@example.com").status_code == 409


def test_limite_membros_429(finance_client):
    client, _, _ = finance_client
    _uparar_para_pro(client)
    for i in range(6):
        assert _convidar(client, f"membro{i}@example.com").status_code == 201
    r = _convidar(client, "lotado@example.com")
    assert r.status_code == 429, r.text


def test_aceitar_com_email_diferente_400(finance_client):
    client, _, session_factory = finance_client
    _uparar_para_pro(client)
    token = _convidar(client, "destinatario@example.com").json()["convite"]["token"]

    outro = _criar_usuario(session_factory, "Outra", "outra-pessoa@example.com")
    with _logado_como(outro.id):
        r = client.post("/api/v1/familia/aceitar", json={"token": token})
        assert r.status_code == 400, r.text
        assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"


def test_cancelar_convite_pendente(finance_client):
    client, _, _ = finance_client
    _uparar_para_pro(client)
    convite_id = _convidar(client, "cancel@example.com").json()["convite"]["id"]

    r = client.post(f"/api/v1/familia/convites/{convite_id}/cancelar")
    assert r.status_code == 200, r.text
    assert client.get("/api/v1/familia").json()["convites"] == []


def test_remover_membro_reverte_plano(finance_client):
    client, _, session_factory = finance_client
    _uparar_para_pro(client)

    token = _convidar(client, "membro@example.com").json()["convite"]["token"]
    membro = _criar_usuario(session_factory, "Membro", "membro@example.com")
    with _logado_como(membro.id):
        client.post("/api/v1/familia/aceitar", json={"token": token})

    membros = client.get("/api/v1/familia").json()["membros"]
    assert len(membros) == 1
    linha_id = membros[0]["id"]

    r = client.post(f"/api/v1/familia/membros/{linha_id}/remover")
    assert r.status_code == 200, r.text
    assert client.get("/api/v1/familia").json()["membros"] == []

    with _logado_como(membro.id):
        assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"


def test_membro_sair_reverte_plano(finance_client):
    client, _, session_factory = finance_client
    _uparar_para_pro(client)
    token = _convidar(client, "membro@example.com").json()["convite"]["token"]
    membro = _criar_usuario(session_factory, "Membro", "membro@example.com")

    with _logado_como(membro.id):
        assert client.post("/api/v1/familia/aceitar", json={"token": token}).status_code == 200
        assert client.post("/api/v1/familia/sair").status_code == 200
        assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"
        assert client.get("/api/v1/familia").json()["papel"] == "nenhum"

    contexto = client.get("/api/v1/familia").json()
    assert contexto["papel"] == "titular"
    assert contexto["membros"] == []


def test_cancelar_assinatura_rebaixa_membros(finance_client):
    client, _, session_factory = finance_client
    _uparar_para_pro(client)
    _criar_e_aceitar(client, session_factory, "membro@example.com")

    assert client.post("/api/v1/assinaturas/cancelar").status_code == 200

    import asyncio
    import sqlalchemy as sa
    from sqlalchemy import select

    async def buscar_membro_id():
        async with session_factory() as session:
            usr = await session.scalar(select(Usuario).where(Usuario.email == "membro@example.com"))
            return usr.id

    membro_id = asyncio.run(buscar_membro_id())
    with _logado_como(membro_id):
        assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"


def test_reassinatura_promove_membros_novamente(finance_client):
    client, _, session_factory = finance_client
    _uparar_para_pro(client)
    _criar_e_aceitar(client, session_factory, "membro@example.com")

    client.post("/api/v1/assinaturas/cancelar")

    import asyncio as _ai
    import sqlalchemy as sa
    from sqlalchemy import select

    async def buscar_membro_id():
        async with session_factory() as session:
            usr = await session.scalar(select(Usuario).where(Usuario.email == "membro@example.com"))
            return usr.id

    membro_id = asyncio.run(buscar_membro_id())
    with _logado_como(membro_id):
        assert client.get("/api/v1/planos/me").json()["nome"] == "gratuito"

    # Titular re-assina o Pro -> membros ativos voltam a Pro automaticamente.
    _uparar_para_pro(client)
    with _logado_como(membro_id):
        assert client.get("/api/v1/planos/me").json()["nome"] == "pro"


def dono_id(fixture):
    return fixture[1]