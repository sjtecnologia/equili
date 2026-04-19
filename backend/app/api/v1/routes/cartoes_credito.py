from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

from sqlalchemy import select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_bancaria import CartaoCredito

router = APIRouter()


class CartaoCreditoCreate(BaseModel):
    nome: str
    bandeira: str  # visa | mastercard | elo | amex | hipercard | outro
    limite: float
    dia_fechamento: int
    dia_vencimento: int
    cor: str = "#1A3C5E"

    @field_validator("bandeira")
    @classmethod
    def bandeira_valida(cls, v: str) -> str:
        if v not in ("visa", "mastercard", "elo", "amex", "hipercard", "outro"):
            raise ValueError("Bandeira inválida.")
        return v

    @field_validator("limite")
    @classmethod
    def limite_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Limite deve ser maior que zero.")
        return v

    @field_validator("dia_fechamento", "dia_vencimento")
    @classmethod
    def dia_valido(cls, v: int) -> int:
        if not 1 <= v <= 31:
            raise ValueError("Dia deve estar entre 1 e 31.")
        return v


class CartaoCreditoUpdate(BaseModel):
    nome: str | None = None
    bandeira: str | None = None
    limite: float | None = None
    dia_fechamento: int | None = None
    dia_vencimento: int | None = None
    cor: str | None = None
    ativo: bool | None = None

    @field_validator("bandeira")
    @classmethod
    def bandeira_valida(cls, v: str | None) -> str | None:
        if v is not None and v not in ("visa", "mastercard", "elo", "amex", "hipercard", "outro"):
            raise ValueError("Bandeira inválida.")
        return v


@router.get("")
async def listar_cartoes(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(CartaoCredito)
        .where(CartaoCredito.usuario_id == usuario_id, CartaoCredito.ativo == True)  # noqa: E712
        .order_by(CartaoCredito.criado_em)
    )
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_cartao(data: CartaoCreditoCreate, usuario_id: CurrentUserID, db: DBSession):
    cartao = CartaoCredito(usuario_id=usuario_id, **data.model_dump())
    db.add(cartao)
    await db.commit()
    await db.refresh(cartao)
    return cartao


@router.patch("/{cartao_id}")
async def atualizar_cartao(cartao_id: UUID, data: CartaoCreditoUpdate, usuario_id: CurrentUserID, db: DBSession):
    cartao = await db.get(CartaoCredito, cartao_id)
    if not cartao or cartao.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Cartão não encontrado.")
    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(cartao, campo, valor)
    await db.commit()
    await db.refresh(cartao)
    return cartao


@router.delete("/{cartao_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_cartao(cartao_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    cartao = await db.get(CartaoCredito, cartao_id)
    if not cartao or cartao.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Cartão não encontrado.")
    await db.delete(cartao)
    await db.commit()
