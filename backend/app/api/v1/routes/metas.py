"""
Metas financeiras — objetivos de poupança com valor alvo, prazo e progresso.

O catálogo de planos limita a QUANTIDADE de metas ativas (grátis = 1,
Premium/Pro = ilimitado). O limite é uma cota de volume -> responde **429**
(nunca 403/401, que o app interpretaria como login expirado).
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select

from app.core import planos as planos_core
from app.core.dependencies import CurrentUserID, DBSession
from app.models.meta import Meta
from app.models.usuario import Usuario

router = APIRouter()


def _meta_dict(meta: Meta) -> dict:
    alvo = float(meta.valor_alvo) or 0.0
    atual = float(meta.valor_atual) or 0.0
    progresso = min(atual / alvo, 1.0) if alvo > 0 else 0.0
    return {
        "id": str(meta.id),
        "titulo": meta.titulo,
        "descricao": meta.descricao,
        "categoria": meta.categoria,
        "valor_alvo": round(alvo, 2),
        "valor_atual": round(atual, 2),
        "prazo": meta.prazo.isoformat() if meta.prazo else None,
        "concluida": bool(meta.concluida),
        "progresso": round(progresso, 4),
        "percentual": round(progresso * 100, 1),
        "restante": round(max(alvo - atual, 0.0), 2),
        "criado_em": meta.criado_em.isoformat() if meta.criado_em else None,
    }


class MetaCreate(BaseModel):
    titulo: str
    descricao: str | None = None
    categoria: str | None = None
    valor_alvo: float
    valor_atual: float = 0.0
    prazo: date | None = None

    @field_validator("titulo")
    @classmethod
    def titulo_valido(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Título é obrigatório.")
        if len(v) > 150:
            raise ValueError("Título deve ter no máximo 150 caracteres.")
        return v

    @field_validator("valor_alvo", "valor_atual")
    @classmethod
    def valor_nao_negativo(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Os valores não podem ser negativos.")
        return v

    @field_validator("valor_alvo")
    @classmethod
    def alvo_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("O valor alvo deve ser maior que zero.")
        return v


class MetaUpdate(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    categoria: str | None = None
    valor_alvo: float | None = None
    prazo: date | None = None
    concluida: bool | None = None

    @field_validator("titulo")
    @classmethod
    def titulo_valido(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Título é obrigatório.")
        if len(v) > 150:
            raise ValueError("Título deve ter no máximo 150 caracteres.")
        return v

    @field_validator("valor_alvo")
    @classmethod
    def alvo_positivo(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("O valor alvo deve ser maior que zero.")
        return v


class Aporte(BaseModel):
    valor: float

    @field_validator("valor")
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("O valor do aporte deve ser maior que zero.")
        return v


async def _verificar_limite_metas(usuario_id: UUID, db) -> None:
    usuario = await db.get(Usuario, usuario_id)
    plano = planos_core.normalizar_plano(usuario.plano if usuario else None)
    limite = planos_core.limite(plano, planos_core.LIMITE_METAS)
    if limite is None:
        return
    count = await db.scalar(
        select(func.count()).where(
            Meta.usuario_id == usuario_id,
            Meta.concluida == False,  # noqa: E712
        )
    )
    if count >= limite:
        rotulo = planos_core.get_plano(plano).rotulo
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Você atingiu o limite de {limite} meta(s) ativa(s) do plano {rotulo}. Conclua uma meta ou faça upgrade para criar mais.",
            headers={"X-Equili-Recurso": planos_core.LIMITE_METAS},
        )


async def _buscar_meta(meta_id: UUID, usuario_id: UUID, db) -> Meta:
    meta = await db.scalar(
        select(Meta).where(Meta.id == meta_id, Meta.usuario_id == usuario_id)
    )
    if not meta:
        raise HTTPException(status_code=404, detail="Meta não encontrada.")
    return meta


@router.get("")
async def listar_metas(usuario_id: CurrentUserID, db: DBSession):
    """Lista as metas do usuário — ativas primeiro, ordenadas por prazo."""
    result = await db.execute(
        select(Meta)
        .where(Meta.usuario_id == usuario_id)
        .order_by(
            Meta.concluida.asc(),
            Meta.prazo.is_(None),
            Meta.prazo.asc(),
            Meta.criado_em.desc(),
        )
    )
    metas = result.scalars().all()

    count_ativas = sum(1 for m in metas if not m.concluida)
    return {
        "metas": [_meta_dict(m) for m in metas],
        "total": len(metas),
        "ativas": count_ativas,
    }


@router.get("/{meta_id}", status_code=200)
async def detalhar_meta(meta_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    meta = await _buscar_meta(meta_id, usuario_id, db)
    return _meta_dict(meta)


@router.post("", status_code=201)
async def criar_meta(
    payload: MetaCreate, usuario_id: CurrentUserID, db: DBSession
):
    await _verificar_limite_metas(usuario_id, db)
    meta = Meta(
        usuario_id=usuario_id,
        titulo=payload.titulo,
        descricao=payload.descricao,
        categoria=payload.categoria,
        valor_alvo=payload.valor_alvo,
        valor_atual=payload.valor_atual,
        prazo=payload.prazo,
        concluida=payload.valor_atual >= payload.valor_alvo,
    )
    db.add(meta)
    await db.commit()
    await db.refresh(meta)
    return _meta_dict(meta)


@router.patch("/{meta_id}")
async def atualizar_meta(
    meta_id: UUID, payload: MetaUpdate, usuario_id: CurrentUserID, db: DBSession
):
    meta = await _buscar_meta(meta_id, usuario_id, db)
    dados = payload.model_dump(exclude_unset=True)
    for campo, valor in dados.items():
        setattr(meta, campo, valor)
    # Consistência: meta com valor atual >= alvo nunca pode ficar "em aberto".
    atingiu = float(meta.valor_atual) >= float(meta.valor_alvo)
    if "concluida" in dados:
        meta.concluida = bool(payload.concluida) or atingiu
    else:
        meta.concluida = atingiu
    await db.commit()
    await db.refresh(meta)
    return _meta_dict(meta)


@router.post("/{meta_id}/aportar")
async def aportar_meta(
    meta_id: UUID, payload: Aporte, usuario_id: CurrentUserID, db: DBSession
):
    meta = await _buscar_meta(meta_id, usuario_id, db)
    meta.valor_atual = float(meta.valor_atual) + payload.valor
    meta.concluida = float(meta.valor_atual) >= float(meta.valor_alvo)
    await db.commit()
    await db.refresh(meta)
    return _meta_dict(meta)


@router.delete("/{meta_id}", status_code=204)
async def excluir_meta(meta_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    meta = await _buscar_meta(meta_id, usuario_id, db)
    await db.delete(meta)
    await db.commit()