from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.core.filtros import contem
from app.models.conta_bancaria import CartaoCredito
from app.models.lancamento_cartao import LancamentoCartao

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────────

class LancamentoCartaoCreate(BaseModel):
    descricao: str
    valor: float
    tipo: str  # compra | pagamento
    data: date
    categoria: str | None = None

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        if v not in ("compra", "pagamento"):
            raise ValueError("Tipo deve ser 'compra' ou 'pagamento'.")
        return v

    @field_validator("valor")
    @classmethod
    def valor_valido(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Valor deve ser positivo.")
        return v


# ─── Helpers ────────────────────────────────────────────────────────────────

async def _get_cartao_or_404(cartao_id: UUID, usuario_id: UUID, db: DBSession) -> CartaoCredito:
    result = await db.execute(
        select(CartaoCredito).where(
            CartaoCredito.id == cartao_id,
            CartaoCredito.usuario_id == usuario_id,
            CartaoCredito.ativo == True,  # noqa: E712
        )
    )
    cartao = result.scalar_one_or_none()
    if not cartao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cartão não encontrado.")
    return cartao


def aplicar_efeito_lancamento(cartao: CartaoCredito, tipo: str, valor: float) -> None:
    """Atualiza limite_atual ao registrar um lançamento (compra decrementa, pagamento incrementa).

    Compra pode deixar limite_atual negativo (estouro é permitido).
    Pagamento nunca eleva limite_atual acima de limite (limite_total).
    """
    if tipo == "compra":
        cartao.limite_atual = float(cartao.limite_atual) - float(valor)
    else:  # pagamento
        cartao.limite_atual = min(float(cartao.limite_atual) + float(valor), float(cartao.limite))


def reverter_efeito_lancamento(cartao: CartaoCredito, tipo: str, valor: float) -> None:
    """Desfaz o efeito de um lançamento no limite_atual (usado na exclusão)."""
    if tipo == "compra":
        cartao.limite_atual = min(float(cartao.limite_atual) + float(valor), float(cartao.limite))
    else:  # pagamento
        cartao.limite_atual = float(cartao.limite_atual) - float(valor)


# ─── Routes ─────────────────────────────────────────────────────────────────

@router.get("/{cartao_id}/lancamentos")
async def listar_lancamentos_cartao(
    cartao_id: UUID,
    usuario_id: CurrentUserID,
    db: DBSession,
    tipo: str | None = None,
    categoria: str | None = None,
    q: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
):
    cartao = await _get_cartao_or_404(cartao_id, usuario_id, db)
    query = select(LancamentoCartao).where(LancamentoCartao.cartao_credito_id == cartao_id)
    if tipo in ("compra", "pagamento"):
        query = query.where(LancamentoCartao.tipo == tipo)
    if categoria and categoria.strip():
        query = query.where(func.lower(func.trim(LancamentoCartao.categoria)) == categoria.strip().lower())
    if q and q.strip():
        query = query.where(contem(LancamentoCartao.descricao, q))
    if data_inicio:
        query = query.where(LancamentoCartao.data >= data_inicio)
    if data_fim:
        query = query.where(LancamentoCartao.data <= data_fim)
    result = await db.execute(query.order_by(LancamentoCartao.data.desc(), LancamentoCartao.criado_em.desc()))
    lancamentos = result.scalars().all()
    limite_atual = float(cartao.limite_atual)
    return {
        "lancamentos": [
            {
                "id": str(l.id),
                "descricao": l.descricao,
                "valor": float(l.valor),
                "tipo": l.tipo,
                "data": l.data.isoformat(),
                "categoria": l.categoria,
            }
            for l in lancamentos
        ],
        "limite_total": float(cartao.limite),
        "limite_atual": limite_atual,
        "limite_disponivel": limite_atual,
        "limite_usado": float(cartao.limite) - limite_atual,
        "nome": cartao.nome,
        "bandeira": cartao.bandeira,
        "cor": cartao.cor,
        "dia_fechamento": cartao.dia_fechamento,
        "dia_vencimento": cartao.dia_vencimento,
    }


@router.post("/{cartao_id}/lancamentos", status_code=status.HTTP_201_CREATED)
async def criar_lancamento_cartao(
    cartao_id: UUID,
    body: LancamentoCartaoCreate,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    cartao = await _get_cartao_or_404(cartao_id, usuario_id, db)
    lancamento = LancamentoCartao(
        cartao_credito_id=cartao_id,
        descricao=body.descricao,
        valor=body.valor,
        tipo=body.tipo,
        data=body.data,
        categoria=body.categoria,
    )
    db.add(lancamento)
    aplicar_efeito_lancamento(cartao, body.tipo, body.valor)
    await db.commit()
    await db.refresh(lancamento)
    return {
        "id": str(lancamento.id),
        "descricao": lancamento.descricao,
        "valor": float(lancamento.valor),
        "tipo": lancamento.tipo,
        "data": lancamento.data.isoformat(),
        "categoria": lancamento.categoria,
    }


@router.delete("/{cartao_id}/lancamentos/{lancamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_lancamento_cartao(
    cartao_id: UUID,
    lancamento_id: UUID,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    cartao = await _get_cartao_or_404(cartao_id, usuario_id, db)
    result = await db.execute(
        select(LancamentoCartao).where(
            LancamentoCartao.id == lancamento_id,
            LancamentoCartao.cartao_credito_id == cartao_id,
        )
    )
    lancamento = result.scalar_one_or_none()
    if not lancamento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lançamento não encontrado.")
    reverter_efeito_lancamento(cartao, lancamento.tipo, float(lancamento.valor))
    await db.delete(lancamento)
    await db.commit()
