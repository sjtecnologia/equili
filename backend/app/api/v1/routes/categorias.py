import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.core.filtros import contem
from app.models.categoria import Categoria
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.schemas.categoria import CategoriaCreate, CategoriaOut, CategoriaUpdate

router = APIRouter()
logger = logging.getLogger(__name__)


async def _buscar(db, categoria_id: UUID, usuario_id: UUID) -> Categoria:
    categoria = await db.get(Categoria, categoria_id)
    if not categoria or categoria.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")
    return categoria


async def _nome_duplicado(db, usuario_id: UUID, tipo: str, nome: str, ignorar_id: UUID | None = None) -> bool:
    query = select(Categoria.id).where(
        Categoria.usuario_id == usuario_id,
        Categoria.tipo == tipo,
        func.lower(Categoria.nome) == nome.lower(),
    )
    if ignorar_id:
        query = query.where(Categoria.id != ignorar_id)
    return (await db.execute(query.limit(1))).first() is not None


async def _em_uso(db, categoria: Categoria) -> bool:
    # Contas referenciam a categoria pelo nome (categoria em pagar, origem em receber)
    if categoria.tipo == "despesa":
        coluna, modelo = ContaAPagar.categoria, ContaAPagar
    else:
        coluna, modelo = ContaAReceber.origem, ContaAReceber
    query = select(modelo.id).where(modelo.usuario_id == categoria.usuario_id, coluna == categoria.nome).limit(1)
    return (await db.execute(query)).first() is not None


@router.post("", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
async def criar_categoria(data: CategoriaCreate, usuario_id: CurrentUserID, db: DBSession):
    if await _nome_duplicado(db, usuario_id, data.tipo, data.nome):
        raise HTTPException(status_code=409, detail="Já existe uma categoria com esse nome para o tipo informado.")
    categoria = Categoria(usuario_id=usuario_id, **data.model_dump())
    db.add(categoria)
    await db.commit()
    await db.refresh(categoria)
    logger.info("Categoria criada: %s (%s)", categoria.nome, categoria.tipo)
    return categoria


@router.get("", response_model=list[CategoriaOut])
async def listar_categorias(
    usuario_id: CurrentUserID,
    db: DBSession,
    tipo: str | None = None,
    ativo: bool | None = None,
    q: str | None = None,
):
    if tipo is not None and tipo not in ("despesa", "receita"):
        raise HTTPException(status_code=422, detail="Tipo inválido. Use: despesa ou receita.")
    query = select(Categoria).where(Categoria.usuario_id == usuario_id)
    if tipo:
        query = query.where(Categoria.tipo == tipo)
    if ativo is not None:
        query = query.where(Categoria.ativo == ativo)
    if q and q.strip():
        query = query.where(contem(Categoria.nome, q))
    result = await db.execute(query.order_by(Categoria.tipo, Categoria.nome))
    return result.scalars().all()


@router.get("/{categoria_id}", response_model=CategoriaOut)
async def obter_categoria(categoria_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    return await _buscar(db, categoria_id, usuario_id)


@router.put("/{categoria_id}", response_model=CategoriaOut)
async def atualizar_categoria(categoria_id: UUID, data: CategoriaUpdate, usuario_id: CurrentUserID, db: DBSession):
    categoria = await _buscar(db, categoria_id, usuario_id)
    campos = data.model_dump(exclude_unset=True)
    if campos.get("nome") is None:
        campos.pop("nome", None)
    if campos.get("tipo") is None:
        campos.pop("tipo", None)
    if campos.get("ativo") is None:
        campos.pop("ativo", None)

    novo_nome = campos.get("nome", categoria.nome)
    novo_tipo = campos.get("tipo", categoria.tipo)
    if (novo_nome, novo_tipo) != (categoria.nome, categoria.tipo):
        if await _nome_duplicado(db, usuario_id, novo_tipo, novo_nome, categoria.id):
            raise HTTPException(status_code=409, detail="Já existe uma categoria com esse nome para o tipo informado.")
        if await _em_uso(db, categoria):
            raise HTTPException(
                status_code=409,
                detail="Categoria em uso por contas; nome e tipo não podem ser alterados.",
            )

    for campo, valor in campos.items():
        setattr(categoria, campo, valor)
    await db.commit()
    await db.refresh(categoria)
    return categoria


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_categoria(categoria_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    categoria = await _buscar(db, categoria_id, usuario_id)
    if await _em_uso(db, categoria):
        raise HTTPException(
            status_code=409,
            detail="Categoria em uso por contas e não pode ser excluída. Desative-a em vez disso.",
        )
    await db.delete(categoria)
    await db.commit()
    logger.info("Categoria removida: %s", categoria_id)
