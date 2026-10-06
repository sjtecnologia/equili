from datetime import date, datetime, time, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select

from app.api.v1.routes.lancamentos_cartao import aplicar_efeito_lancamento, reverter_efeito_lancamento
from app.models.conta_bancaria import ContaBancaria, CartaoCredito
from app.models.conta_lancamento import BaixaConta, ContaAPagar, ContaAReceber
from app.models.lancamento_conta import LancamentoConta
from app.models.lancamento_cartao import LancamentoCartao


class BaixaRequest(BaseModel):
    valor: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    data: date | None = None
    conta_id: UUID | None = None
    cartao_id: UUID | None = None
    meio: str = "dinheiro"

    @model_validator(mode="before")
    @classmethod
    def inferir_meio(cls, data):
        if isinstance(data, dict) and "meio" not in data:
            data = {**data, "meio": "conta" if data.get("conta_id") else "cartao" if data.get("cartao_id") else "dinheiro"}
        return data

    @model_validator(mode="after")
    def validar_meio(self):
        if self.meio not in {"conta", "cartao", "dinheiro"}:
            raise ValueError("Meio de baixa invalido.")
        if self.conta_id and self.cartao_id:
            raise ValueError("Selecione apenas uma conta ou cartao.")
        if self.meio == "dinheiro" and (self.conta_id or self.cartao_id):
            raise ValueError("Baixa em dinheiro nao pode indicar conta ou cartao.")
        if (self.meio == "conta" and self.cartao_id) or (self.meio == "cartao" and self.conta_id):
            raise ValueError("Meio de baixa nao corresponde a conta ou cartao selecionado.")
        if self.meio == "conta" and not self.conta_id:
            raise ValueError("Selecione uma conta bancaria.")
        if self.meio == "cartao" and not self.cartao_id:
            raise ValueError("Selecione um cartao.")
        return self


async def obter_conta(db, usuario_id, conta_id, receber=False):
    conta = await db.get(ContaAReceber if receber else ContaAPagar, conta_id, with_for_update=True)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(404, "Conta nao encontrada.")
    return conta


async def listar_baixas(db, conta, receber=False):
    campo = BaixaConta.receber_id if receber else BaixaConta.pagar_id
    return (await db.scalars(select(BaixaConta).where(campo == conta.id, BaixaConta.usuario_id == conta.usuario_id).order_by(BaixaConta.data, BaixaConta.criado_em, BaixaConta.id))).all()


async def movimentar(db, conta, baixa, receber=False, estorno=False):
    if baixa.conta_id:
        banco = await db.get(ContaBancaria, baixa.conta_id, with_for_update=True)
        if not banco or banco.usuario_id != conta.usuario_id:
            raise HTTPException(409 if estorno else 404, "Conta bancaria nao encontrada para esta baixa.")
        db.add(LancamentoConta(
            conta_bancaria_id=banco.id,
            descricao=("Estorno: " if estorno else "") + conta.descricao[:140],
            valor=baixa.valor,
            tipo="entrada" if receber != estorno else "saida",
            data=baixa.data,
            categoria=conta.origem if receber else conta.categoria,
            origem="estorno_baixa" if estorno else ("contas_receber" if receber else "contas_pagar"),
        ))
    elif baixa.cartao_id:
        cartao = await db.get(CartaoCredito, baixa.cartao_id, with_for_update=True)
        if not cartao or cartao.usuario_id != conta.usuario_id:
            raise HTTPException(409 if estorno else 404, "Cartao nao encontrado para esta baixa.")
        if estorno:
            reverter_efeito_lancamento(cartao, "compra", float(baixa.valor))
        else:
            aplicar_efeito_lancamento(cartao, "compra", float(baixa.valor))
        db.add(LancamentoCartao(
            cartao_credito_id=cartao.id,
            descricao=("Estorno: " if estorno else "") + conta.descricao[:140],
            valor=baixa.valor, tipo="pagamento" if estorno else "compra", data=baixa.data,
            categoria=conta.categoria,
        ))


async def atualizar_resumo(db, conta, receber=False):
    await db.flush()
    ativas = [b for b in await listar_baixas(db, conta, receber) if b.cancelada_em is None]
    conta.valor_baixado = sum((b.valor for b in ativas), Decimal("0"))
    completo = conta.valor_baixado == conta.valor
    vencimento = conta.data_prevista if receber else conta.data_vencimento
    conta.status = ("recebido" if receber else "pago") if completo else (
        "parcial" if conta.valor_baixado else (
            ("atrasado" if receber else "vencido") if vencimento < date.today() else "pendente"
        )
    )
    ultima = ativas[-1] if ativas else None
    conta.conta_id = ultima.conta_id if ultima else None
    instante = datetime.combine(ultima.data, time.min, timezone.utc) if ultima else None
    if receber:
        conta.recebido_em = instante
        conta.data_recebimento = ultima.data if ultima else None
        conta.meio_recebimento = ultima.meio if ultima else None
    else:
        conta.pago_em = instante
        conta.cartao_id = ultima.cartao_id if ultima else None
        if conta.divida_id:
            await sincronizar_divida(db, conta, completo, ultima)


async def sincronizar_divida(db, conta, completo, ultima):
    from app.models.divida import Divida, DividaPagamento
    divida = await db.get(Divida, conta.divida_id, with_for_update=True)
    if not divida or divida.usuario_id != conta.usuario_id:
        return
    pagamentos = (await db.scalars(select(DividaPagamento).where(
        DividaPagamento.divida_id == divida.id,
        DividaPagamento.usuario_id == conta.usuario_id,
        DividaPagamento.data_referencia == conta.data_vencimento,
    ))).all()
    if completo and not pagamentos:
        db.add(DividaPagamento(
            divida_id=divida.id, usuario_id=conta.usuario_id,
            data_referencia=conta.data_vencimento, data_pagamento=ultima.data,
            valor_pago=conta.valor_baixado, valor_parcela_original=conta.valor,
        ))
        divida.parcelas_restantes = max(0, divida.parcelas_restantes - 1)
    elif not completo and pagamentos:
        for pagamento in pagamentos:
            await db.delete(pagamento)
        divida.parcelas_restantes += 1
    else:
        return
    divida.quitada = divida.parcelas_restantes == 0
    await db.flush()
    proxima = await db.scalar(select(ContaAPagar.data_vencimento).where(
        ContaAPagar.divida_id == divida.id, ContaAPagar.usuario_id == conta.usuario_id,
        ContaAPagar.status != "pago",
    ).order_by(ContaAPagar.data_vencimento).limit(1))
    if proxima:
        divida.data_prox_vencimento = proxima


async def registrar_baixa(db, conta, data, receber=False):
    if receber and data.cartao_id:
        raise HTTPException(422, "Recebimento nao pode ser feito em cartao de credito.")
    restante = Decimal(str(conta.valor)) - Decimal(str(conta.valor_baixado))
    valor = data.valor if data.valor is not None else restante
    if restante <= 0:
        raise HTTPException(409, "Conta ja esta liquidada.")
    if valor <= 0 or valor > restante:
        raise HTTPException(422, "Valor da baixa deve ser positivo e nao superar o saldo restante.")
    baixa = BaixaConta(
        usuario_id=conta.usuario_id,
        receber_id=conta.id if receber else None, pagar_id=None if receber else conta.id,
        valor=valor, data=data.data or date.today(),
        meio="conta" if data.conta_id else "cartao" if data.cartao_id else "dinheiro",
        conta_id=data.conta_id, cartao_id=data.cartao_id,
        criado_em=datetime.now(timezone.utc),
    )
    await movimentar(db, conta, baixa, receber)
    db.add(baixa)
    await atualizar_resumo(db, conta, receber)
    return baixa


async def cancelar_baixa(db, conta, baixa_id, receber=False):
    baixa = await db.get(BaixaConta, baixa_id, with_for_update=True)
    if not baixa or baixa.usuario_id != conta.usuario_id or (
        baixa.receber_id if receber else baixa.pagar_id
    ) != conta.id:
        raise HTTPException(404, "Baixa nao encontrada.")
    if baixa.cancelada_em:
        raise HTTPException(409, "Baixa ja cancelada.")
    await movimentar(db, conta, baixa, receber, estorno=True)
    baixa.cancelada_em = datetime.now(timezone.utc)
    await atualizar_resumo(db, conta, receber)
    return baixa
