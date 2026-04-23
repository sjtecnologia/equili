from calendar import monthrange
from datetime import date, datetime, timezone
from uuid import UUID

from uuid import UUID as PyUUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_bancaria import CartaoCredito, ContaBancaria
from app.models.conta_lancamento import ContaAPagar
from app.models.lancamento_cartao import LancamentoCartao
from app.models.lancamento_conta import LancamentoConta

router = APIRouter()

CATEGORIAS_VALIDAS = {
    "moradia", "transporte", "saude", "educacao",
    "alimentacao", "lazer", "outro",
}
STATUS_VALIDOS = {"pendente", "pago", "vencido"}
MODALIDADES_VALIDAS = {"avulsa", "recorrente", "parcelada"}


def _add_months(dt: date, months: int) -> date:
    """Soma N meses a uma data, ajustando o dia ao último do mês se necessário."""
    total = dt.month + months
    year = dt.year + (total - 1) // 12
    month = ((total - 1) % 12) + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


class ContaAPagarCreate(BaseModel):
    descricao: str
    categoria: str
    valor: float
    data_vencimento: date
    modalidade: str = "avulsa"   # avulsa | recorrente | parcelada
    numero_parcelas: int | None = None  # obrigatório quando modalidade=parcelada
    observacao: str | None = None

    @field_validator("valor")
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Valor deve ser maior que zero.")
        return v

    @field_validator("categoria")
    @classmethod
    def categoria_valida(cls, v: str) -> str:
        if v not in CATEGORIAS_VALIDAS:
            raise ValueError(f"Categoria inválida. Use: {', '.join(sorted(CATEGORIAS_VALIDAS))}")
        return v

    @field_validator("modalidade")
    @classmethod
    def modalidade_valida(cls, v: str) -> str:
        if v not in MODALIDADES_VALIDAS:
            raise ValueError("Modalidade inválida. Use: avulsa, recorrente ou parcelada.")
        return v

    @model_validator(mode="after")
    def valida_parcelas(self) -> "ContaAPagarCreate":
        if self.modalidade == "parcelada":
            if not self.numero_parcelas or self.numero_parcelas < 2:
                raise ValueError("Informe ao menos 2 parcelas para conta parcelada.")
        return self


TIPOS_VALIDOS = {"avulsa", "fixa", "variavel"}


class ContaAPagarUpdate(BaseModel):
    descricao: str | None = None
    categoria: str | None = None
    valor: float | None = None
    data_vencimento: date | None = None
    tipo: str | None = None  # avulsa | fixa | variavel
    observacao: str | None = None

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str | None) -> str | None:
        if v is not None and v not in TIPOS_VALIDOS:
            raise ValueError("Tipo inválido. Use: avulsa, fixa ou variavel.")
        return v


class PagarRequest(BaseModel):
    data_pagamento: date | None = None
    conta_bancaria_id: PyUUID | None = None
    cartao_credito_id: PyUUID | None = None


@router.get("/fixas-atrasadas")
async def contas_fixas_atrasadas(usuario_id: CurrentUserID, db: DBSession):
    """Retorna contas recorrentes (tipo=fixa) vencidas e não pagas, agrupadas por descrição."""
    hoje = date.today()
    result = await db.execute(
        select(
            ContaAPagar.descricao,
            ContaAPagar.categoria,
            func.count(ContaAPagar.id).label("meses_atrasados"),
            func.sum(ContaAPagar.valor).label("total"),
            func.min(ContaAPagar.data_vencimento).label("primeira_data"),
            func.max(ContaAPagar.data_vencimento).label("ultima_data"),
        )
        .where(
            ContaAPagar.usuario_id == usuario_id,
            ContaAPagar.tipo == "fixa",
            ContaAPagar.status == "pendente",
            ContaAPagar.data_vencimento < hoje,
        )
        .group_by(ContaAPagar.descricao, ContaAPagar.categoria)
        .order_by(func.min(ContaAPagar.data_vencimento))
    )
    rows = result.all()
    return [
        {
            "descricao": r.descricao,
            "categoria": r.categoria,
            "meses_atrasados": r.meses_atrasados,
            "total": float(r.total),
            "primeira_data": r.primeira_data.isoformat(),
            "ultima_data": r.ultima_data.isoformat(),
        }
        for r in rows
    ]


@router.get("")
async def listar_contas_pagar(
    usuario_id: CurrentUserID,
    db: DBSession,
    status: str | None = None,
    mes: int | None = None,
    ano: int | None = None,
):
    query = select(ContaAPagar).where(ContaAPagar.usuario_id == usuario_id)
    if status and status in STATUS_VALIDOS:
        query = query.where(ContaAPagar.status == status)
    if mes and ano:
        from sqlalchemy import extract
        query = query.where(
            extract("month", ContaAPagar.data_vencimento) == mes,
            extract("year", ContaAPagar.data_vencimento) == ano,
        )
    query = query.order_by(ContaAPagar.data_vencimento)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_conta_pagar(
    data: ContaAPagarCreate, usuario_id: CurrentUserID, db: DBSession
):
    """
    Cria lançamentos de conta a pagar conforme a modalidade:
    - avulsa: 1 lançamento
    - recorrente: 1 lançamento por mês do mês inicial até dezembro do mesmo ano
    - parcelada: 1 lançamento por parcela, mensalmente, com "(N/total)" na descrição
    """
    contas_novas: list[ContaAPagar] = []

    if data.modalidade == "recorrente":
        n_meses = 12 - data.data_vencimento.month + 1
        for i in range(n_meses):
            conta = ContaAPagar(
                usuario_id=usuario_id,
                descricao=data.descricao,
                categoria=data.categoria,
                valor=data.valor,
                data_vencimento=_add_months(data.data_vencimento, i),
                tipo="fixa",
                observacao=data.observacao,
            )
            db.add(conta)
            contas_novas.append(conta)

    elif data.modalidade == "parcelada":
        n = data.numero_parcelas  # >= 2 garantido pelo validator
        for i in range(n):
            conta = ContaAPagar(
                usuario_id=usuario_id,
                descricao=f"{data.descricao} ({i + 1}/{n})",
                categoria=data.categoria,
                valor=data.valor,
                data_vencimento=_add_months(data.data_vencimento, i),
                tipo="variavel",
                observacao=data.observacao,
            )
            db.add(conta)
            contas_novas.append(conta)

    else:  # avulsa
        conta = ContaAPagar(
            usuario_id=usuario_id,
            descricao=data.descricao,
            categoria=data.categoria,
            valor=data.valor,
            data_vencimento=data.data_vencimento,
            tipo="avulsa",
            observacao=data.observacao,
        )
        db.add(conta)
        contas_novas.append(conta)

    await db.commit()
    for c in contas_novas:
        await db.refresh(c)

    return contas_novas


@router.patch("/{conta_id}")
async def atualizar_conta_pagar(
    conta_id: UUID, data: ContaAPagarUpdate, usuario_id: CurrentUserID, db: DBSession
):
    conta = await db.get(ContaAPagar, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(conta, campo, valor)
    await db.commit()
    await db.refresh(conta)
    return conta


@router.patch("/{conta_id}/pagar", status_code=status.HTTP_200_OK)
async def marcar_como_pago(
    conta_id: UUID, usuario_id: CurrentUserID, db: DBSession,
    data: PagarRequest | None = None,
):
    from datetime import time

    conta = await db.get(ContaAPagar, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")

    data_pagto = (data.data_pagamento if data and data.data_pagamento else date.today())
    conta.status = "pago"
    conta.pago_em = datetime.combine(data_pagto, time.min).replace(tzinfo=timezone.utc)

    # Gera lançamento automático se informada conta bancária ou cartão
    if data and data.conta_bancaria_id:
        cb = await db.get(ContaBancaria, data.conta_bancaria_id)
        if not cb or cb.usuario_id != usuario_id:
            raise HTTPException(status_code=404, detail="Conta bancária não encontrada.")
        db.add(LancamentoConta(
            conta_bancaria_id=data.conta_bancaria_id,
            descricao=conta.descricao,
            valor=conta.valor,
            tipo="saida",
            data=data_pagto,
            categoria=conta.categoria,
            origem="contas_pagar",
        ))
    elif data and data.cartao_credito_id:
        cc = await db.get(CartaoCredito, data.cartao_credito_id)
        if not cc or cc.usuario_id != usuario_id:
            raise HTTPException(status_code=404, detail="Cartão de crédito não encontrado.")
        db.add(LancamentoCartao(
            cartao_credito_id=data.cartao_credito_id,
            descricao=conta.descricao,
            valor=conta.valor,
            tipo="compra",
            data=data_pagto,
            categoria=conta.categoria,
        ))

    await db.commit()
    await db.refresh(conta)
    return conta


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_conta_pagar(
    conta_id: UUID, usuario_id: CurrentUserID, db: DBSession
):
    conta = await db.get(ContaAPagar, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    await db.delete(conta)
    await db.commit()
