from __future__ import annotations

import asyncio
from datetime import date, timedelta
from uuid import UUID, uuid4

from app.core import config as config_module
from app.models.divida import Divida, DividaPagamento
from app.models.usuario import Usuario


def test_criar_divida_e_pagar_parcela(finance_client):
    client, user_id, session_factory = finance_client
    data_primeira = date.today() + timedelta(days=5)

    response = client.post(
        "/api/v1/dividas",
        json={
            "descricao": "Cartão de Crédito",
            "credor": "Banco do Brasil",
            "tipo": "cartao_parcelado",
            "valor_total": 2400.0,
            "valor_parcela": 400.0,
            "parcelas_totais": 6,
            "parcelas_restantes": 6,
            "data_primeira_parcela": data_primeira.isoformat(),
            "data_prox_vencimento": data_primeira.isoformat(),
        },
    )

    assert response.status_code == 201, response.text
    divida = response.json()
    assert divida["valor_total"] == 2400.0
    assert divida["valor_parcela"] == 400.0
    assert divida["parcelas_restantes"] == 6
    divida_id = divida["id"]

    pagamento = client.post(
        f"/api/v1/dividas/{divida_id}/pagar-parcela",
        json={
            "data_referencia": data_primeira.isoformat(),
            "data_pagamento": (date.today() + timedelta(days=1)).isoformat(),
            "valor_pago": 400.0,
            "observacao": "Parcela do cartão",
        },
    )

    assert pagamento.status_code == 200, pagamento.text
    payload = pagamento.json()
    assert payload["quitada"] is False
    assert payload["parcelas_restantes"] == 5

    async def load_payment_record():
        async with session_factory() as session:
            result = await session.execute(
                __import__("sqlalchemy").select(DividaPagamento).where(DividaPagamento.divida_id == UUID(divida_id))
            )
            return result.scalars().all()

    pagamentos = asyncio.run(load_payment_record())
    assert len(pagamentos) == 1
    assert float(pagamentos[0].valor_pago) == 400.0
    assert float(pagamentos[0].valor_parcela_original) == 400.0


def test_divida_finaliza_quando_ultima_parcela_e_paga(finance_client):
    client, user_id, session_factory = finance_client
    hoje = date.today()

    response = client.post(
        "/api/v1/dividas",
        json={
            "descricao": "Empréstimo pessoal",
            "credor": "Banco",
            "tipo": "emprestimo",
            "valor_total": 500.0,
            "valor_parcela": 500.0,
            "parcelas_totais": 1,
            "parcelas_restantes": 1,
            "data_primeira_parcela": hoje.isoformat(),
            "data_prox_vencimento": hoje.isoformat(),
        },
    )

    assert response.status_code == 201, response.text
    divida = response.json()
    divida_id = divida["id"]

    pagamento = client.post(
        f"/api/v1/dividas/{divida_id}/pagar-parcela",
        json={
            "data_referencia": hoje.isoformat(),
            "data_pagamento": hoje.isoformat(),
            "valor_pago": 500.0,
        },
    )

    assert pagamento.status_code == 200, pagamento.text
    payload = pagamento.json()
    assert payload["quitada"] is True
    assert payload["parcelas_restantes"] == 0

    async def load_divida_state():
        async with session_factory() as session:
            result = await session.execute(__import__("sqlalchemy").select(Divida).where(Divida.id == UUID(divida_id)))
            return result.scalars().first()

    divida_db = asyncio.run(load_divida_state())
    assert divida_db is not None
    assert divida_db.quitada is True
    assert divida_db.parcelas_restantes == 0


def test_dividas_do_plano_gratuito_limitam_3_ativas(finance_client, monkeypatch):
    client, user_id, session_factory = finance_client
    previous = config_module.settings.PLANO_GRATIS_MAX_DIVIDAS
    config_module.settings.PLANO_GRATIS_MAX_DIVIDAS = 3

    try:
        for idx in range(3):
            response = client.post(
                "/api/v1/dividas",
                json={
                    "descricao": f"Dívida {idx + 1}",
                    "credor": "Banco",
                    "tipo": "emprestimo",
                    "valor_total": 1000.0 + idx,
                    "valor_parcela": 200.0 + idx,
                    "parcelas_totais": 5,
                    "parcelas_restantes": 5,
                    "data_primeira_parcela": (date.today() + timedelta(days=idx + 1)).isoformat(),
                    "data_prox_vencimento": (date.today() + timedelta(days=idx + 1)).isoformat(),
                },
            )
            assert response.status_code == 201, response.text

        response = client.post(
            "/api/v1/dividas",
            json={
                "descricao": "Dívida extra",
                "credor": "Banco",
                "tipo": "emprestimo",
                "valor_total": 2000.0,
                "valor_parcela": 400.0,
                "parcelas_totais": 5,
                "parcelas_restantes": 5,
                "data_primeira_parcela": (date.today() + timedelta(days=30)).isoformat(),
                "data_prox_vencimento": (date.today() + timedelta(days=30)).isoformat(),
            },
        )

        assert response.status_code == 403, response.text
        payload = response.json()
        assert "limite" in payload["detail"].lower()
    finally:
        config_module.settings.PLANO_GRATIS_MAX_DIVIDAS = previous


def test_listar_dividas_isola_usuarios(finance_client):
    client, user_id, session_factory = finance_client
    user_b_id = uuid4()

    async def seed_users_and_dividas():
        async with session_factory() as session:
            session.add(
                Usuario(
                    id=user_b_id,
                    nome="Usuário B",
                    email=f"b-{user_b_id}@example.com",
                    senha_hash="hashed-password",
                    plano="gratuito",
                    email_verificado=True,
                    ativo=True,
                )
            )
            session.add(
                Divida(
                    usuario_id=user_id,
                    descricao="Dívida A",
                    credor="Banco",
                    tipo="emprestimo",
                    valor_total=1000.0,
                    valor_parcela=250.0,
                    parcelas_totais=4,
                    parcelas_restantes=4,
                    data_prox_vencimento=date.today() + timedelta(days=2),
                    data_primeira_parcela=date.today() + timedelta(days=2),
                )
            )
            session.add(
                Divida(
                    usuario_id=user_b_id,
                    descricao="Dívida B",
                    credor="Banco",
                    tipo="emprestimo",
                    valor_total=5000.0,
                    valor_parcela=500.0,
                    parcelas_totais=10,
                    parcelas_restantes=10,
                    data_prox_vencimento=date.today() + timedelta(days=5),
                    data_primeira_parcela=date.today() + timedelta(days=5),
                )
            )
            await session.commit()

    asyncio.run(seed_users_and_dividas())

    response = client.get("/api/v1/dividas")
    assert response.status_code == 200, response.text
    dividas = response.json()
    assert len(dividas) == 1
    assert dividas[0]["descricao"] == "Dívida A"
    assert dividas[0]["usuario_id"] == str(user_id)
