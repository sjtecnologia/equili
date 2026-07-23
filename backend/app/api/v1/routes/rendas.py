from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.renda import Renda

router = APIRouter()


class RendaCreate(BaseModel):
    descricao: str
    valor: float
    frequencia: str  # mensal | quinzenal | semanal
    tipo: str  # salario | freela | aluguel | outro

    @field_validator("valor")
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("O valor deve ser maior que zero.")
        return v

    @field_validator("frequencia")
    @classmethod
    def frequencia_valida(cls, v: str) -> str:
        if v not in ("mensal", "quinzenal", "semanal"):
            raise ValueError("Frequência inválida.")
        return v


class RendaUpdate(BaseModel):
    descricao: str | None = None
    valor: float | None = None
    frequencia: str | None = None
    tipo: str | None = None
    ativo: bool | None = None


@router.get("")
async def listar_rendas(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(Renda).where(Renda.usuario_id == usuario_id, Renda.ativo == True)  # noqa: E712
    )
    rendas = result.scalars().all()
    return rendas


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_renda(data: RendaCreate, usuario_id: CurrentUserID, db: DBSession):
    renda = Renda(usuario_id=usuario_id, **data.model_dump())
    db.add(renda)
    await db.commit()
    await db.refresh(renda)
    return renda


@router.patch("/{renda_id}")
async def atualizar_renda(renda_id: UUID, data: RendaUpdate, usuario_id: CurrentUserID, db: DBSession):
    renda = await db.get(Renda, renda_id)
    if not renda or renda.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Renda não encontrada.")

    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(renda, campo, valor)

    await db.commit()
    await db.refresh(renda)
    return renda


@router.delete("/{renda_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_renda(renda_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    renda = await db.get(Renda, renda_id)
    if not renda or renda.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Renda não encontrada.")
    await db.delete(renda)
    await db.commit()
