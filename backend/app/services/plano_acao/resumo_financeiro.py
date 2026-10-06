"""Resumo financeiro compacto do usuário, pronto para virar JSON no prompt do Plano de Ação."""
from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conta_bancaria import CartaoCredito, ContaBancaria
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida
from app.models.lancamento_cartao import LancamentoCartao
from app.models.lancamento_conta import LancamentoConta
from app.models.renda import Renda

MAX_DIVIDAS = 15
MAX_PROXIMAS = 8
FATOR_MENSAL = {"mensal": 1.0, "quinzenal": 2.0, "semanal": 52 / 12}


def _r(v) -> float:
    return round(float(v or 0), 2)


def _totais_pendentes(linhas, campo_data: str, hoje: date) -> dict:
    """linhas: (descricao, categoria, data, valor) ordenadas por data."""
    limite = hoje + timedelta(days=30)
    total = vencido = prox_30d = 0.0
    for _, _, data, valor in linhas:
        v = float(valor)
        total += v
        if data < hoje:
            vencido += v
        elif data <= limite:
            prox_30d += v
    return {
        "total": _r(total),
        "quantidade": len(linhas),
        "vencido": _r(vencido),
        "proximos_30_dias": _r(prox_30d),
        f"proximas_{campo_data}": [
            {"descricao": d, "categoria": c, "data": data.isoformat(), "valor": _r(v)}
            for d, c, data, v in linhas[:MAX_PROXIMAS]
        ],
    }


async def montar_resumo_financeiro(db: AsyncSession, usuario_id: UUID, hoje: date | None = None) -> dict:
    hoje = hoje or date.today()
    inicio_mes = hoje.replace(day=1)

    # Contas bancárias: saldo_inicial + soma dos lançamentos (entrada +, saída -)
    contas = (await db.execute(
        select(ContaBancaria).where(ContaBancaria.usuario_id == usuario_id, ContaBancaria.ativo == True)  # noqa: E712
    )).scalars().all()
    movimento = {}
    if contas:
        movimento = dict((await db.execute(
            select(
                LancamentoConta.conta_bancaria_id,
                func.sum(case((LancamentoConta.tipo == "entrada", LancamentoConta.valor), else_=-LancamentoConta.valor)),
            )
            .where(LancamentoConta.conta_bancaria_id.in_([c.id for c in contas]))
            .group_by(LancamentoConta.conta_bancaria_id)
        )).all())
    contas_out = [
        {"nome": c.nome, "saldo_atual": _r(float(c.saldo_inicial) + float(movimento.get(c.id) or 0))} for c in contas
    ]

    pagar = (await db.execute(
        select(ContaAPagar.descricao, ContaAPagar.categoria, ContaAPagar.data_vencimento, (ContaAPagar.valor - ContaAPagar.valor_baixado).label("valor"))
        .where(ContaAPagar.usuario_id == usuario_id, ContaAPagar.status != "pago")
        .order_by(ContaAPagar.data_vencimento)
    )).all()
    receber = (await db.execute(
        select(ContaAReceber.descricao, ContaAReceber.origem, ContaAReceber.data_prevista, (ContaAReceber.valor - ContaAReceber.valor_baixado).label("valor"))
        .where(ContaAReceber.usuario_id == usuario_id, ContaAReceber.status != "recebido")
        .order_by(ContaAReceber.data_prevista)
    )).all()
    a_pagar = _totais_pendentes(pagar, "contas", hoje)
    a_receber = _totais_pendentes(receber, "contas", hoje)

    dividas = (await db.execute(
        select(Divida).where(Divida.usuario_id == usuario_id, Divida.quitada == False)  # noqa: E712
        .order_by(Divida.data_prox_vencimento)
    )).scalars().all()
    dividas_out = [
        {
            "descricao": d.descricao,
            "credor": d.credor,
            "tipo": d.tipo,
            "valor_total": _r(d.valor_total),
            "valor_parcela": _r(d.valor_parcela),
            "parcelas_restantes": d.parcelas_restantes,
            # sem coluna de saldo devedor: estimado por parcela x parcelas restantes
            "valor_restante": _r(float(d.valor_parcela) * d.parcelas_restantes),
            "proximo_vencimento": d.data_prox_vencimento.isoformat(),
            "juros_mensal_pct": _r(float(d.taxa_juros_mensal) * 100) if d.taxa_juros_mensal else None,
        }
        for d in dividas[:MAX_DIVIDAS]
    ]

    cartoes = (await db.execute(
        select(CartaoCredito).where(CartaoCredito.usuario_id == usuario_id, CartaoCredito.ativo == True)  # noqa: E712
    )).scalars().all()
    cartoes_out = [
        {
            "nome": c.nome,
            "limite_total": _r(c.limite),
            "limite_atual": _r(c.limite_atual),
            # sem coluna de fatura: o usado do limite é a fatura pendente
            "fatura_pendente": _r(max(float(c.limite) - float(c.limite_atual), 0)),
        }
        for c in cartoes
    ]

    rendas = (await db.execute(
        select(Renda).where(Renda.usuario_id == usuario_id, Renda.ativo == True)  # noqa: E712
    )).scalars().all()
    renda_mensal = sum(float(r.valor) * FATOR_MENSAL.get(r.frequencia, 1.0) for r in rendas)

    # Saídas do mês por categoria: lançamentos de conta (saída) + compras no cartão
    gastos: dict[str, float] = {}
    por_conta = (await db.execute(
        select(LancamentoConta.categoria, func.sum(LancamentoConta.valor))
        .join(ContaBancaria, ContaBancaria.id == LancamentoConta.conta_bancaria_id)
        .where(ContaBancaria.usuario_id == usuario_id, LancamentoConta.tipo == "saida",
               LancamentoConta.data >= inicio_mes, LancamentoConta.data <= hoje)
        .group_by(LancamentoConta.categoria)
    )).all()
    por_cartao = (await db.execute(
        select(LancamentoCartao.categoria, func.sum(LancamentoCartao.valor))
        .join(CartaoCredito, CartaoCredito.id == LancamentoCartao.cartao_credito_id)
        .where(CartaoCredito.usuario_id == usuario_id, LancamentoCartao.tipo == "compra",
               LancamentoCartao.data >= inicio_mes, LancamentoCartao.data <= hoje)
        .group_by(LancamentoCartao.categoria)
    )).all()
    for categoria, total in [*por_conta, *por_cartao]:
        nome = (categoria or "").strip() or "sem categoria"
        gastos[nome] = gastos.get(nome, 0.0) + float(total or 0)
    top_categorias = [
        {"categoria": k, "total": _r(v)} for k, v in sorted(gastos.items(), key=lambda kv: kv[1], reverse=True)[:5]
    ]

    saldo_contas = sum(c["saldo_atual"] for c in contas_out)
    return {
        "data_atual": hoje.isoformat(),
        "renda_mensal_total": _r(renda_mensal),
        "qtd_rendas": len(rendas),
        "saldo_total_contas": _r(saldo_contas),
        "contas_bancarias": contas_out,
        "a_pagar_pendente": a_pagar,
        "a_receber_pendente": a_receber,
        "saldo_projetado_30_dias": _r(saldo_contas + a_receber["proximos_30_dias"] - a_pagar["proximos_30_dias"] - a_pagar["vencido"]),
        "dividas": dividas_out,
        "total_restante_dividas": _r(sum(d["valor_restante"] for d in dividas_out)),
        "cartoes": cartoes_out,
        "top_categorias_saida_mes": top_categorias,
    }
