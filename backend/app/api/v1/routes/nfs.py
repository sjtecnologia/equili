from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select

from app.core.dependencies import CurrentUserID, DBSession
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
async def listar_nfs(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(NfsRecebida)
        .where(NfsRecebida.user_id == usuario_id)
        .order_by(NfsRecebida.created_at.desc())
    )
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
