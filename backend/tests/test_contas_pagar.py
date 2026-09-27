from __future__ import annotations

import asyncio
from datetime import date, timedelta
from uuid import UUID, uuid4

from app.models.conta_bancaria import ContaBancaria
from app.models.conta_lancamento import ContaAPagar
from app.models.lancamento_conta import LancamentoConta
from app.models.usuario import Usuario


def test_criar_e_pagar_conta_pagar(finance_client):
    client, user_id, session_factory = finance_client
    data_vencimento = date.today() + timedelta(days=15)

    async def seed_bank_account():
        async with session_factory() as session:
            conta = ContaBancaria(
                usuario_id=user_id,
                nome="Conta Corrente",
                banco="Banco Teste",
                tipo="corrente",
                saldo_inicial=0.0,
            )
            session.add(conta)
            await session.commit()
            await session.refresh(conta)
            return conta.id

    conta_bancaria_id = asyncio.run(seed_bank_account())

    response = client.post(
        "/api/v1/contas-pagar",
        json={
            "descricao": "Aluguel",
            "categoria": "moradia",
            "valor": 1200.0,
            "data_vencimento": data_vencimento.isoformat(),
            "modalidade": "avulsa",
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert len(payload) == 1
    conta = payload[0]
    assert conta["descricao"] == "Aluguel"
    assert conta["valor"] == 1200.0
    assert conta["data_vencimento"] == data_vencimento.isoformat()
    conta_id = conta["id"]

    pagar_response = client.patch(
        f"/api/v1/contas-pagar/{conta_id}/pagar",
        json={
            "data_pagamento": (date.today() + timedelta(days=2)).isoformat(),
            "conta_bancaria_id": str(conta_bancaria_id),
        },
    )

    assert pagar_response.status_code == 200, pagar_response.text
    pago = pagar_response.json()
    assert pago["status"] == "pago"
    assert float(pago["valor"]) == 1200.0
    assert pago["pago_em"] is not None

    async def load_account_and_ledger():
        async with session_factory() as session:
            conta_db = (await session.execute(__import__("sqlalchemy").select(ContaAPagar).where(ContaAPagar.id == UUID(conta_id)))).scalars().first()
            lancamentos = (
                await session.execute(
                    __import__("sqlalchemy").select(LancamentoConta)
                    .where(LancamentoConta.conta_bancaria_id == UUID(str(conta_bancaria_id)))
                )
            ).scalars().all()
            return conta_db, lancamentos

    conta_db, lancamentos = asyncio.run(load_account_and_ledger())
    assert conta_db is not None
    assert conta_db.status == "pago"
    assert len(lancamentos) == 1
    assert float(lancamentos[0].valor) == 1200.0
    assert lancamentos[0].tipo == "saida"
    assert lancamentos[0].origem == "contas_pagar"


def test_listar_contas_pagar_isola_usuarios(finance_client):
    client, user_id, session_factory = finance_client
    user_b_id = uuid4()

    async def seed_users_and_accounts():
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
                ContaAPagar(
                    usuario_id=user_id,
                    descricao="Conta do usuário A",
                    categoria="saude",
                    valor=350.0,
                    data_vencimento=date.today() + timedelta(days=7),
                    status="pendente",
                    tipo="avulsa",
                )
            )
            session.add(
                ContaAPagar(
                    usuario_id=user_b_id,
                    descricao="Conta do usuário B",
                    categoria="educacao",
                    valor=900.0,
                    data_vencimento=date.today() + timedelta(days=9),
                    status="pendente",
                    tipo="avulsa",
                )
            )
            await session.commit()

    asyncio.run(seed_users_and_accounts())

    response = client.get("/api/v1/contas-pagar")
    assert response.status_code == 200, response.text
    contas = response.json()
    assert len(contas) == 1
    assert contas[0]["descricao"] == "Conta do usuário A"
    assert contas[0]["usuario_id"] == str(user_id)
