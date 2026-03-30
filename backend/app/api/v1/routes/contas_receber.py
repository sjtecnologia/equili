from calendar import monthrange
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_lancamento import ContaAReceber

router = APIRouter()

ORIGENS_VALIDAS = {"salario", "freela", "venda", "emprestimo", "outro"}
STATUS_VALIDOS = {"pendente", "recebido", "atrasado"}
MODALIDADES_VALIDAS = {"avulsa", "recorrente", "parcelada"}


def _add_months(dt: date, months: int) -> date:
    """Soma N meses a uma data, ajustando o dia ao último do mês se necessário."""
    total = dt.month + months
    year = dt.year + (total - 1) // 12
    month = ((total - 1) % 12) + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


class ContaAReceberCreate(BaseModel):
    descricao: str
    origem: str
    valor: float
    data_prevista: date
    modalidade: str = "avulsa"  # avulsa | recorrente | parcelada
    numero_parcelas: int | None = None  # obrigatório quando modalidade=parcelada
    devedor: str | None = None
    observacao: str | None = None

    @field_validator("valor")
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Valor deve ser maior que zero.")
        return v

    @field_validator("origem")
    @classmethod
    def origem_valida(cls, v: str) -> str:
        if v not in ORIGENS_VALIDAS:
            raise ValueError(f"Origem inválida. Use: {', '.join(sorted(ORIGENS_VALIDAS))}")
        return v

    @field_validator("modalidade")
    @classmethod
    def modalidade_valida(cls, v: str) -> str:
        if v not in MODALIDADES_VALIDAS:
            raise ValueError("Modalidade inválida. Use: avulsa, recorrente ou parcelada.")
        return v

    @model_validator(mode="after")
    def valida_parcelas(self) -> "ContaAReceberCreate":
        if self.modalidade == "parcelada":
            if not self.numero_parcelas or self.numero_parcelas < 2:
                raise ValueError("Informe ao menos 2 parcelas para conta parcelada.")
        return self


class ContaAReceberUpdate(BaseModel):
    descricao: str | None = None
    origem: str | None = None
    valor: float | None = None
    data_prevista: date | None = None
    devedor: str | None = None
    observacao: str | None = None


@router.get("")
async def listar_contas_receber(
    usuario_id: CurrentUserID,
    db: DBSession,
    status: str | None = None,
    mes: int | None = None,
    ano: int | None = None,
):
    query = select(ContaAReceber).where(ContaAReceber.usuario_id == usuario_id)
    if status and status in STATUS_VALIDOS:
        query = query.where(ContaAReceber.status == status)
    if mes and ano:
        from sqlalchemy import extract
        query = query.where(
            extract("month", ContaAReceber.data_prevista) == mes,
            extract("year", ContaAReceber.data_prevista) == ano,
        )
    query = query.order_by(ContaAReceber.data_prevista)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_conta_receber(
    data: ContaAReceberCreate, usuario_id: CurrentUserID, db: DBSession
):
    """
    Cria lançamentos de conta a receber conforme a modalidade:
    - avulsa: 1 lançamento
    - recorrente: 1 lançamento por mês do mês inicial até dezembro do mesmo ano
    - parcelada: 1 lançamento por parcela, mensalmente, com "(N/total)" na descrição
    """
    contas_novas: list[ContaAReceber] = []

    if data.modalidade == "recorrente":
        n_meses = 12 - data.data_prevista.month + 1
        for i in range(n_meses):
            conta = ContaAReceber(
                usuario_id=usuario_id,
                descricao=data.descricao,
                origem=data.origem,
                valor=data.valor,
                tipo="recorrente",
                data_prevista=_add_months(data.data_prevista, i),
                devedor=data.devedor,
                observacao=data.observacao,
            )
            db.add(conta)
            contas_novas.append(conta)

    elif data.modalidade == "parcelada":
        n = data.numero_parcelas
        for i in range(n):
            conta = ContaAReceber(
                usuario_id=usuario_id,
                descricao=f"{data.descricao} ({i + 1}/{n})",
                origem=data.origem,
                valor=data.valor,
                tipo="parcelada",
                data_prevista=_add_months(data.data_prevista, i),
                devedor=data.devedor,
                observacao=data.observacao,
            )
            db.add(conta)
            contas_novas.append(conta)

    else:  # avulsa
        conta = ContaAReceber(
            usuario_id=usuario_id,
            descricao=data.descricao,
            origem=data.origem,
            valor=data.valor,
            tipo="avulsa",
            data_prevista=data.data_prevista,
            devedor=data.devedor,
            observacao=data.observacao,
        )
        db.add(conta)
        contas_novas.append(conta)

    await db.commit()
    for c in contas_novas:
        await db.refresh(c)
    return contas_novas


@router.patch("/{conta_id}")
async def atualizar_conta_receber(
    conta_id: UUID, data: ContaAReceberUpdate, usuario_id: CurrentUserID, db: DBSession
):
    conta = await db.get(ContaAReceber, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(conta, campo, valor)
    await db.commit()
    await db.refresh(conta)
    return conta


@router.patch("/{conta_id}/receber", status_code=status.HTTP_200_OK)
async def marcar_como_recebido(
    conta_id: UUID, usuario_id: CurrentUserID, db: DBSession
):
    conta = await db.get(ContaAReceber, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    conta.status = "recebido"
    conta.recebido_em = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conta)
    return conta


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_conta_receber(
    conta_id: UUID, usuario_id: CurrentUserID, db: DBSession
):
    conta = await db.get(ContaAReceber, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    await db.delete(conta)
    await db.commit()
