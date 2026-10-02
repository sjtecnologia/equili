from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.categoria import Categoria

# Categorias que antes eram fixas no código (CATEGORIAS_VALIDAS / ORIGENS_VALIDAS).
CATEGORIAS_PADRAO: dict[str, tuple[str, ...]] = {
    "despesa": ("moradia", "transporte", "saude", "educacao", "alimentacao", "lazer", "outro"),
    "receita": ("salario", "freela", "venda", "emprestimo", "outro"),
}


async def seed_categorias_padrao(db: AsyncSession, usuario_id: UUID) -> None:
    """Insere as categorias padrão que o usuário ainda não tem (sem commit)."""
    existentes = {
        (tipo, nome.strip().lower())
        for tipo, nome in (
            await db.execute(select(Categoria.tipo, Categoria.nome).where(Categoria.usuario_id == usuario_id))
        ).all()
    }
    for tipo, nomes in CATEGORIAS_PADRAO.items():
        for nome in nomes:
            if (tipo, nome) not in existentes:
                db.add(Categoria(usuario_id=usuario_id, tipo=tipo, nome=nome, ativo=True))
