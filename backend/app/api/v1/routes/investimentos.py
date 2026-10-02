"""
CRUD de investimentos — rastreamento manual de carteira.
"""
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select

from app.core.dependencies import CurrentUserID, DBSession
from app.core.filtros import contem
from app.models.investimento import Investimento

router = APIRouter(prefix="/investimentos", tags=["Investimentos"])

TIPOS_VALIDOS = {"acoes", "fii", "renda_fixa", "criptomoeda", "tesouro", "outro"}

# ─── Schemas ─────────────────────────────────────────────────────────────────

class InvestimentoBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=150)
    tipo: str
    instituicao: Optional[str] = None
    quantidade: Optional[float] = None
    preco_medio: Optional[float] = None
    valor_investido: float = Field(..., gt=0)
    valor_atual: float = Field(..., ge=0)
    data_aplicacao: date
    observacao: Optional[str] = None


class InvestimentoCreate(InvestimentoBase):
    pass


class InvestimentoUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=150)
    tipo: Optional[str] = None
    instituicao: Optional[str] = None
    quantidade: Optional[float] = None
    preco_medio: Optional[float] = None
    valor_investido: Optional[float] = Field(None, gt=0)
    valor_atual: Optional[float] = Field(None, ge=0)
    data_aplicacao: Optional[date] = None
    observacao: Optional[str] = None


class InvestimentoOut(BaseModel):
    id: UUID
    nome: str
    tipo: str
    instituicao: Optional[str]
    quantidade: Optional[float]
    preco_medio: Optional[float]
    valor_investido: float
    valor_atual: float
    rentabilidade_pct: float
    data_aplicacao: date
    observacao: Optional[str]

    model_config = {"from_attributes": True}


class CarteiraResumo(BaseModel):
    total_investido: float
    total_atual: float
    rentabilidade_pct: float
    por_tipo: dict[str, float]  # tipo -> valor_atual


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _validar_tipo(tipo: str) -> None:
    if tipo not in TIPOS_VALIDOS:
        raise HTTPException(
            status_code=422,
            detail=f"Tipo inválido. Valores aceitos: {', '.join(sorted(TIPOS_VALIDOS))}",
        )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[InvestimentoOut])
async def listar(
    db: DBSession,
    usuario_id: CurrentUserID,
    tipo: str | None = None,
    q: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
):
    query = select(Investimento).where(Investimento.usuario_id == usuario_id)
    if tipo:
        query = query.where(Investimento.tipo == tipo)
    if q and q.strip():
        query = query.where(or_(contem(Investimento.nome, q), contem(Investimento.instituicao, q)))
    if data_inicio:
        query = query.where(Investimento.data_aplicacao >= data_inicio)
    if data_fim:
        query = query.where(Investimento.data_aplicacao <= data_fim)
    result = await db.execute(query.order_by(Investimento.tipo, Investimento.nome))
    return result.scalars().all()


@router.get("/resumo", response_model=CarteiraResumo)
async def resumo_carteira(db: DBSession, usuario_id: CurrentUserID):
    result = await db.execute(
        select(Investimento).where(Investimento.usuario_id == usuario_id)
    )
    investimentos = result.scalars().all()

    if not investimentos:
        return CarteiraResumo(total_investido=0, total_atual=0, rentabilidade_pct=0, por_tipo={})

    total_investido = sum(float(i.valor_investido) for i in investimentos)
    total_atual = sum(float(i.valor_atual) for i in investimentos)
    rentabilidade = ((total_atual - total_investido) / total_investido * 100) if total_investido else 0

    por_tipo: dict[str, float] = {}
    for inv in investimentos:
        por_tipo[inv.tipo] = por_tipo.get(inv.tipo, 0) + float(inv.valor_atual)

    return CarteiraResumo(
        total_investido=total_investido,
        total_atual=total_atual,
        rentabilidade_pct=round(rentabilidade, 2),
        por_tipo=por_tipo,
    )


@router.post("", response_model=InvestimentoOut, status_code=status.HTTP_201_CREATED)
async def criar(body: InvestimentoCreate, db: DBSession, usuario_id: CurrentUserID):
    _validar_tipo(body.tipo)
    inv = Investimento(usuario_id=usuario_id, **body.model_dump())
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.patch("/{inv_id}", response_model=InvestimentoOut)
async def atualizar(inv_id: UUID, body: InvestimentoUpdate, db: DBSession, usuario_id: CurrentUserID):
    result = await db.execute(
        select(Investimento).where(Investimento.id == inv_id, Investimento.usuario_id == usuario_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")

    data = body.model_dump(exclude_unset=True)
    if "tipo" in data:
        _validar_tipo(data["tipo"])

    for field, value in data.items():
        setattr(inv, field, value)

    await db.commit()
    await db.refresh(inv)
    return inv


@router.delete("/{inv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar(inv_id: UUID, db: DBSession, usuario_id: CurrentUserID):
    result = await db.execute(
        select(Investimento).where(Investimento.id == inv_id, Investimento.usuario_id == usuario_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    await db.delete(inv)
    await db.commit()
