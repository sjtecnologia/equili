from __future__ import annotations

import asyncio
from datetime import date, timedelta

from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida
from app.models.renda import Renda


def test_resumo_dashboard_calcula_fluxo_real(finance_client):
    client, user_id, session_factory = finance_client

    async def seed_financial_state():
        hoje = date.today()
        async with session_factory() as session:
            session.add(Renda(usuario_id=user_id, descricao="Salário", valor=5000.0, frequencia="mensal", tipo="salario", ativo=True))
            session.add(
                ContaAPagar(
                    usuario_id=user_id,
                    descricao="Aluguel",
                    categoria="moradia",
                    valor=1200.0,
                    data_vencimento=hoje + timedelta(days=10),
                    status="pendente",
                    tipo="fixa",
                )
            )
            session.add(
                ContaAPagar(
                    usuario_id=user_id,
                    descricao="Energia",
                    categoria="moradia",
                    valor=300.0,
                    data_vencimento=hoje + timedelta(days=18),
                    status="pendente",
                    tipo="avulsa",
                )
            )
            session.add(
                ContaAReceber(
                    usuario_id=user_id,
                    descricao="Freela",
                    origem="freela",
                    valor=1800.0,
                    data_prevista=hoje + timedelta(days=5),
                    status="pendente",
                    tipo="avulsa",
                )
            )
            session.add(
                Divida(
                    usuario_id=user_id,
                    descricao="Financiamento",
                    credor="Banco",
                    tipo="financiamento",
                    valor_total=9000.0,
                    valor_parcela=1500.0,
                    parcelas_totais=6,
                    parcelas_restantes=5,
                    data_prox_vencimento=hoje + timedelta(days=2),
                    data_primeira_parcela=hoje + timedelta(days=2),
                )
            )
            await session.commit()

    asyncio.run(seed_financial_state())

    response = client.get("/api/v1/dashboard/resumo")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["renda_total"] == 5000.0
    assert payload["total_dividas"] == 9000.0
    assert payload["total_a_pagar_30d"] == 1500.0
    assert payload["total_a_receber_30d"] == 1800.0
    assert payload["saldo_projetado_30d"] == 5300.0
