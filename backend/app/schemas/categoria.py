from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

TIPOS_CATEGORIA = ("despesa", "receita")


def _nome_valido(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Nome não pode ser vazio.")
    return v


def _tipo_valido(v: str) -> str:
    if v not in TIPOS_CATEGORIA:
        raise ValueError("Tipo inválido. Use: despesa ou receita.")
    return v


class CategoriaBase(BaseModel):
    nome: str
    tipo: str
    cor: str | None = None
    icone: str | None = None

    @field_validator("nome")
    @classmethod
    def nome_valido(cls, v: str) -> str:
        return _nome_valido(v)

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        return _tipo_valido(v)


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):
    nome: str | None = None
    tipo: str | None = None
    cor: str | None = None
    icone: str | None = None
    ativo: bool | None = None

    @field_validator("nome")
    @classmethod
    def nome_valido(cls, v: str | None) -> str | None:
        return None if v is None else _nome_valido(v)

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str | None) -> str | None:
        return None if v is None else _tipo_valido(v)


class CategoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    tipo: str
    cor: str | None
    icone: str | None
    ativo: bool
    created_at: datetime | None
    updated_at: datetime | None
