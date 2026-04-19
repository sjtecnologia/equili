from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

from sqlalchemy import select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_bancaria import ContaBancaria

router = APIRouter()


class ContaBancariaCreate(BaseModel):
    nome: str
    banco: str
    tipo: str  # corrente | poupanca | investimento | digital
    saldo_inicial: float = 0.0
    cor: str = "#2E7D5E"

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        if v not in ("corrente", "poupanca", "investimento", "digital"):
            raise ValueError("Tipo inválido.")
        return v

    @field_validator("saldo_inicial")
    @classmethod
    def saldo_valido(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Saldo inicial não pode ser negativo.")
        return v


class ContaBancariaUpdate(BaseModel):
    nome: str | None = None
    banco: str | None = None
    tipo: str | None = None
    saldo_inicial: float | None = None
    cor: str | None = None
    ativo: bool | None = None

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str | None) -> str | None:
        if v is not None and v not in ("corrente", "poupanca", "investimento", "digital"):
            raise ValueError("Tipo inválido.")
        return v


@router.get("")
async def listar_contas_bancarias(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(ContaBancaria)
        .where(ContaBancaria.usuario_id == usuario_id, ContaBancaria.ativo == True)  # noqa: E712
        .order_by(ContaBancaria.criado_em)
    )
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_conta_bancaria(data: ContaBancariaCreate, usuario_id: CurrentUserID, db: DBSession):
    conta = ContaBancaria(usuario_id=usuario_id, **data.model_dump())
    db.add(conta)
    await db.commit()
    await db.refresh(conta)
    return conta


@router.patch("/{conta_id}")
async def atualizar_conta_bancaria(conta_id: UUID, data: ContaBancariaUpdate, usuario_id: CurrentUserID, db: DBSession):
    conta = await db.get(ContaBancaria, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(conta, campo, valor)
    await db.commit()
    await db.refresh(conta)
    return conta


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_conta_bancaria(conta_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    conta = await db.get(ContaBancaria, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    await db.delete(conta)
    await db.commit()
