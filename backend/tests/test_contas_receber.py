from __future__ import annotations

import asyncio
from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.models.conta_bancaria import ContaBancaria
from app.models.conta_lancamento import ContaAReceber
from app.models.lancamento_conta import LancamentoConta
from app.models.usuario import Usuario


def test_criar_e_receber_conta_receber(finance_client):
    client, user_id, session_factory = finance_client
    data_prevista = date.today() + timedelta(days=12)

    async def seed_bank_account():
        async with session_factory() as session:
            conta = ContaBancaria(
                usuario_id=user_id,
                nome="Conta de Recebimento",
                banco="Banco Teste",
                tipo="corrente",
                saldo_inicial=1500.0,
            )
            session.add(conta)
            await session.commit()
            await session.refresh(conta)
            return conta.id

    conta_bancaria_id = asyncio.run(seed_bank_account())

    response = client.post(
        "/api/v1/contas-receber",
        json={
            "descricao": "Salário",
            "origem": "salario",
            "valor": 3500.0,
            "data_prevista": data_prevista.isoformat(),
            "modalidade": "avulsa",
            "devedor": "Empresa",
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload[0]["valor"] == 3500.0
    assert payload[0]["status"] == "pendente"
    conta_id = payload[0]["id"]

    receber_response = client.patch(
        f"/api/v1/contas-receber/{conta_id}/receber",
        json={
            "data_recebimento": (date.today() + timedelta(days=2)).isoformat(),
            "conta_bancaria_id": str(conta_bancaria_id),
        },
    )

    assert receber_response.status_code == 200, receber_response.text
    recebido = receber_response.json()
    assert recebido["status"] == "recebido"
    assert recebido["valor"] == 3500.0
    assert recebido["recebido_em"] is not None

    async def load_ledger_entries():
        async with session_factory() as session:
            result = await session.execute(
                select(LancamentoConta).where(LancamentoConta.conta_bancaria_id == conta_bancaria_id)
            )
            return result.scalars().all()

    lancamentos = asyncio.run(load_ledger_entries())
    assert len(lancamentos) == 1
    assert float(lancamentos[0].valor) == 3500.0
    assert lancamentos[0].tipo == "entrada"
    assert lancamentos[0].origem == "contas_receber"


def test_listar_contas_receber_isola_usuarios(finance_client):
    client, user_id, session_factory = finance_client
    user_b_id = uuid4()

    async def seed_users_and_receivables():
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
                ContaAReceber(
                    usuario_id=user_id,
                    descricao="Receita do usuário A",
                    origem="freela",
                    valor=800.0,
                    data_prevista=date.today() + timedelta(days=5),
                    status="pendente",
                    tipo="avulsa",
                )
            )
            session.add(
                ContaAReceber(
                    usuario_id=user_b_id,
                    descricao="Receita do usuário B",
                    origem="venda",
                    valor=2000.0,
                    data_prevista=date.today() + timedelta(days=10),
                    status="pendente",
                    tipo="avulsa",
                )
            )
            await session.commit()

    asyncio.run(seed_users_and_receivables())

    response = client.get("/api/v1/contas-receber")
    assert response.status_code == 200, response.text
    contas = response.json()
    assert len(contas) == 1
    assert contas[0]["descricao"] == "Receita do usuário A"
    assert contas[0]["usuario_id"] == str(user_id)
