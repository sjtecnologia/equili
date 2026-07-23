from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import case, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.listas import ItemCompra, Tarefa

router = APIRouter()


class TarefaCreate(BaseModel):
    titulo: str

    @field_validator("titulo")
    @classmethod
    def titulo_valido(cls, v: str) -> str:
        titulo = v.strip()
        if len(titulo) < 2:
            raise ValueError("Informe uma tarefa com pelo menos 2 caracteres.")
        return titulo


class TarefaUpdate(BaseModel):
    titulo: str | None = None
    concluida: bool | None = None

    @field_validator("titulo")
    @classmethod
    def titulo_valido(cls, v: str | None) -> str | None:
        if v is None:
            return v
        titulo = v.strip()
        if len(titulo) < 2:
            raise ValueError("Informe uma tarefa com pelo menos 2 caracteres.")
        return titulo


class ItemCompraCreate(BaseModel):
    nome: str
    quantidade: float = 1
    unidade: str | None = None
    observacao: str | None = None

    @field_validator("nome")
    @classmethod
    def nome_valido(cls, v: str) -> str:
        nome = v.strip()
        if len(nome) < 2:
            raise ValueError("Informe um item com pelo menos 2 caracteres.")
        return nome

    @field_validator("quantidade")
    @classmethod
    def quantidade_valida(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("A quantidade deve ser maior que zero.")
        return v


class ItemCompraUpdate(BaseModel):
    nome: str | None = None
    quantidade: float | None = None
    unidade: str | None = None
    comprado: bool | None = None
    observacao: str | None = None

    @field_validator("nome")
    @classmethod
    def nome_valido(cls, v: str | None) -> str | None:
        if v is None:
            return v
        nome = v.strip()
        if len(nome) < 2:
            raise ValueError("Informe um item com pelo menos 2 caracteres.")
        return nome

    @field_validator("quantidade")
    @classmethod
    def quantidade_valida(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("A quantidade deve ser maior que zero.")
        return v


@router.get("/tarefas")
async def listar_tarefas(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(Tarefa)
        .where(Tarefa.usuario_id == usuario_id)
        .order_by(case((Tarefa.concluida.is_(False), 0), else_=1), Tarefa.criado_em.desc())
    )
    return result.scalars().all()


@router.post("/tarefas", status_code=status.HTTP_201_CREATED)
async def criar_tarefa(data: TarefaCreate, usuario_id: CurrentUserID, db: DBSession):
    tarefa = Tarefa(usuario_id=usuario_id, titulo=data.titulo)
    db.add(tarefa)
    await db.commit()
    await db.refresh(tarefa)
    return tarefa


@router.patch("/tarefas/{tarefa_id}")
async def atualizar_tarefa(
    tarefa_id: UUID,
    data: TarefaUpdate,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    tarefa = await db.get(Tarefa, tarefa_id)
    if not tarefa or tarefa.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(tarefa, campo, valor)

    await db.commit()
    await db.refresh(tarefa)
    return tarefa


@router.delete("/tarefas/{tarefa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_tarefa(tarefa_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    tarefa = await db.get(Tarefa, tarefa_id)
    if not tarefa or tarefa.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    await db.delete(tarefa)
    await db.commit()


@router.get("/compras")
async def listar_itens_compra(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(ItemCompra)
        .where(ItemCompra.usuario_id == usuario_id)
        .order_by(case((ItemCompra.comprado.is_(False), 0), else_=1), ItemCompra.criado_em.desc())
    )
    return result.scalars().all()


@router.post("/compras", status_code=status.HTTP_201_CREATED)
async def criar_item_compra(data: ItemCompraCreate, usuario_id: CurrentUserID, db: DBSession):
    item = ItemCompra(usuario_id=usuario_id, **data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/compras/{item_id}")
async def atualizar_item_compra(
    item_id: UUID,
    data: ItemCompraUpdate,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    item = await db.get(ItemCompra, item_id)
    if not item or item.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Item não encontrado.")

    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(item, campo, valor)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/compras/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_item_compra(item_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    item = await db.get(ItemCompra, item_id)
    if not item or item.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Item não encontrado.")

    await db.delete(item)
    await db.commit()
