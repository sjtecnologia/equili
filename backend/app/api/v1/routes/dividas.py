from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select

from app.core.config import settings
from app.core.dependencies import CurrentUserID, DBSession
from app.models.divida import Divida
from app.models.usuario import Usuario

router = APIRouter()

TIPOS_VALIDOS = {"cartao_parcelado", "emprestimo", "financiamento", "cheque_pre", "outro"}


class DividaCreate(BaseModel):
    descricao: str
    credor: str | None = None
    tipo: str
    valor_total: float
    valor_parcela: float
    parcelas_restantes: int
    taxa_juros_mensal: float | None = None
    data_prox_vencimento: date

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        if v not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo inválido. Use: {', '.join(TIPOS_VALIDOS)}")
        return v

    @field_validator("valor_total", "valor_parcela")
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("O valor deve ser maior que zero.")
        return v

    @field_validator("parcelas_restantes")
    @classmethod
    def parcelas_validas(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Parcelas restantes não pode ser negativo.")
        return v


class DividaUpdate(BaseModel):
    descricao: str | None = None
    credor: str | None = None
    valor_parcela: float | None = None
    parcelas_restantes: int | None = None
    taxa_juros_mensal: float | None = None
    data_prox_vencimento: date | None = None


async def _verificar_limite_dividas(usuario_id: UUID, db) -> None:
    usuario = await db.get(Usuario, usuario_id)
    if usuario and usuario.plano == "gratuito":
        count = await db.scalar(
            select(func.count()).where(
                Divida.usuario_id == usuario_id,
                Divida.quitada == False,  # noqa: E712
            )
        )
        if count >= settings.PLANO_GRATIS_MAX_DIVIDAS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Você atingiu o limite de {settings.PLANO_GRATIS_MAX_DIVIDAS} dívidas do plano gratuito. Faça upgrade para adicionar mais.",
            )


@router.get("")
async def listar_dividas(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(Divida)
        .where(Divida.usuario_id == usuario_id, Divida.quitada == False)  # noqa: E712
        .order_by(Divida.data_prox_vencimento)
    )
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_divida(data: DividaCreate, usuario_id: CurrentUserID, db: DBSession):
    await _verificar_limite_dividas(usuario_id, db)

    divida = Divida(usuario_id=usuario_id, **data.model_dump())
    db.add(divida)
    await db.commit()
    await db.refresh(divida)
    return divida


@router.patch("/{divida_id}")
async def atualizar_divida(divida_id: UUID, data: DividaUpdate, usuario_id: CurrentUserID, db: DBSession):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")

    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(divida, campo, valor)

    await db.commit()
    await db.refresh(divida)
    return divida


@router.delete("/{divida_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_divida(divida_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")
    await db.delete(divida)
    await db.commit()


@router.post("/{divida_id}/pagar-parcela")
async def pagar_parcela(divida_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")

    if divida.parcelas_restantes > 0:
        divida.parcelas_restantes -= 1

    if divida.parcelas_restantes == 0:
        divida.quitada = True

    await db.commit()
    await db.refresh(divida)
    return {"quitada": divida.quitada, "parcelas_restantes": divida.parcelas_restantes}
