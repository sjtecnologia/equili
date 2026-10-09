from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator

from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_bancaria import CartaoCredito

router = APIRouter()


class CartaoCreditoCreate(BaseModel):
    nome: str
    bandeira: str  # visa | mastercard | elo | amex | hipercard | outro
    limite: float
    limite_atual: float | None = None  # se omitido, herda o valor de "limite"
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

    @field_validator("limite_atual")
    @classmethod
    def limite_atual_nao_negativo(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Limite atual não pode ser negativo.")
        return v

    @field_validator("dia_fechamento", "dia_vencimento")
    @classmethod
    def dia_valido(cls, v: int) -> int:
        if not 1 <= v <= 31:
            raise ValueError("Dia deve estar entre 1 e 31.")
        return v

    @model_validator(mode="after")
    def limite_atual_nao_excede_limite(self) -> "CartaoCreditoCreate":
        if self.limite_atual is not None and self.limite_atual > self.limite:
            raise ValueError("Limite atual não pode ser maior que o limite total.")
        return self


class CartaoCreditoUpdate(BaseModel):
    nome: str | None = None
    bandeira: str | None = None
    limite: float | None = None
    limite_atual: float | None = None
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

    @field_validator("limite_atual")
    @classmethod
    def limite_atual_nao_negativo(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Limite atual não pode ser negativo.")
        return v


@router.get("")
async def listar_cartoes(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(CartaoCredito)
        .where(CartaoCredito.usuario_id == usuario_id, CartaoCredito.ativo == True)  # noqa: E712
        .order_by(CartaoCredito.criado_em)
    )
    cartoes = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "nome": c.nome,
            "bandeira": c.bandeira,
            "limite": float(c.limite),
            "limite_atual": float(c.limite_atual),
            "limite_utilizado": float(c.limite) - float(c.limite_atual),
            "dia_fechamento": c.dia_fechamento,
            "dia_vencimento": c.dia_vencimento,
            "cor": c.cor,
            "ativo": c.ativo,
        }
        for c in cartoes
    ]


async def _verificar_limite_cartoes(usuario_id: UUID, db) -> None:
    from app.core import planos
    from app.models.usuario import Usuario

    usuario = await db.get(Usuario, usuario_id)
    plano = planos.normalizar_plano(usuario.plano if usuario else None)
    limite = planos.limite(plano, planos.LIMITE_CARTOES_CREDITO)
    if limite is None:
        return
    count = await db.scalar(
        select(func.count()).where(
            CartaoCredito.usuario_id == usuario_id,
            CartaoCredito.ativo == True,  # noqa: E712
        )
    )
    if count >= limite:
        rotulo = planos.get_plano(plano).rotulo
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Você atingiu o limite de {limite} cartão(ões) do plano {rotulo}. Faça upgrade para adicionar mais.",
            headers={"X-Equili-Recurso": planos.LIMITE_CARTOES_CREDITO},
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_cartao(data: CartaoCreditoCreate, usuario_id: CurrentUserID, db: DBSession):
    await _verificar_limite_cartoes(usuario_id, db)
    payload = data.model_dump()
    limite_atual = payload.pop("limite_atual")
    if limite_atual is None:
        limite_atual = payload["limite"]
    cartao = CartaoCredito(usuario_id=usuario_id, limite_atual=limite_atual, **payload)
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
    if float(cartao.limite_atual) > float(cartao.limite):
        raise HTTPException(status_code=400, detail="Limite atual não pode ser maior que o limite total.")
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
