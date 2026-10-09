from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_session

bearer_scheme = HTTPBearer()


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> UUID:
    from app.models.usuario import Usuario

    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )

    usuario = await db.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )
    if usuario.ativo is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário desativado. Contate o administrador.",
        )

    return user_id


# Aliases para injeção de dependência nas rotas
CurrentUserID = Annotated[UUID, Depends(get_current_user_id)]
DBSession = Annotated[AsyncSession, Depends(get_session)]


async def CurrentAdmin(usuario_id: CurrentUserID, db: DBSession) -> UUID:
    from app.models.usuario import Usuario

    usuario = await db.get(Usuario, usuario_id)
    if usuario and usuario.ativo is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário desativado. Contate o administrador.",
        )
    if not usuario or not usuario.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores.",
        )
    return usuario_id


async def get_current_plano(usuario_id: CurrentUserID, db: DBSession) -> str:
    """Nome do plano do usuário, normalizado contra o catálogo."""
    from app.core import planos
    from app.models.usuario import Usuario

    usuario = await db.get(Usuario, usuario_id)
    return planos.normalizar_plano(usuario.plano if usuario else None)


CurrentPlano = Annotated[str, Depends(get_current_plano)]


def requer_recurso(recurso: str):
    """Factory de dependência: exige que o plano do usuário libere ``recurso``.

    Responde **402 Payment Required** (e não 403) de propósito: o frontend
    trata 403 como falha de autenticação e deslogaria o usuário.
    """

    async def _verificar(plano: CurrentPlano) -> None:
        from app.core import planos

        if not planos.tem_recurso(plano, recurso):
            rotulo = planos.get_plano(plano).rotulo
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=(
                    f"Este recurso não está disponível no plano {rotulo}. "
                    "Faça upgrade para liberar."
                ),
                headers={"X-Equili-Recurso": recurso},
            )

    return _verificar
