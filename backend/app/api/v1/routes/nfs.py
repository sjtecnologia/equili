from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import or_, select

from app.core.dependencies import CurrentUserID, DBSession
from app.core.filtros import contem
from app.models.nfs_recebida import NfsRecebida

router = APIRouter()


class NfsRecebidaCreate(BaseModel):
    numero: str
    serie: str | None = None
    valor: float
    chave_acesso: str
    codigo_verificacao: str | None = None
    cpf_cnpj: str | None = None
    inscricao_municipal: str | None = None
    url_consulta: str | None = None
    data_emissao: datetime | None = None

    @field_validator("numero")
    @classmethod
    def numero_obrigatorio(cls, v: str) -> str:
        valor = (v or '').strip()
        if not valor:
            raise ValueError('Número da nota fiscal é obrigatório.')
        return valor

    @field_validator("valor")
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError('O valor da nota fiscal deve ser maior que zero.')
        return v

    @field_validator("chave_acesso")
    @classmethod
    def chave_valida(cls, v: str) -> str:
        valor = (v or '').strip()
        if not valor:
            raise ValueError('A chave de acesso da nota fiscal é obrigatória.')
        return valor


@router.get("")
async def listar_nfs(
    usuario_id: CurrentUserID,
    db: DBSession,
    q: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    valor_min: float | None = None,
    valor_max: float | None = None,
):
    query = select(NfsRecebida).where(NfsRecebida.user_id == usuario_id)
    if q and q.strip():
        query = query.where(or_(
            contem(NfsRecebida.numero, q), contem(NfsRecebida.chave_acesso, q),
            contem(NfsRecebida.cpf_cnpj, q), contem(NfsRecebida.serie, q),
        ))
    # data_emissao é timestamptz: o período é interpretado em UTC, fim inclusivo
    if data_inicio:
        query = query.where(NfsRecebida.data_emissao >= datetime.combine(data_inicio, time.min, tzinfo=timezone.utc))
    if data_fim:
        query = query.where(
            NfsRecebida.data_emissao < datetime.combine(data_fim + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )
    if valor_min is not None:
        query = query.where(NfsRecebida.valor >= valor_min)
    if valor_max is not None:
        query = query.where(NfsRecebida.valor <= valor_max)
    result = await db.execute(query.order_by(NfsRecebida.created_at.desc()))
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_nfs(data: NfsRecebidaCreate, usuario_id: CurrentUserID, db: DBSession):
    payload = data.model_dump(exclude_none=True)
    payload["user_id"] = usuario_id
    payload["data_emissao"] = payload.get("data_emissao") or datetime.now(timezone.utc)

    nota = NfsRecebida(**payload)
    db.add(nota)
    await db.commit()
    await db.refresh(nota)
    return nota


@router.delete("/{nfs_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_nfs(nfs_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    nota = await db.get(NfsRecebida, nfs_id)
    if not nota or nota.user_id != usuario_id:
        raise HTTPException(status_code=404, detail='Nota fiscal não encontrada.')

    await db.delete(nota)
    await db.commit()
