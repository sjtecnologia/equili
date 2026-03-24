from app.core.dependencies import CurrentUserID, DBSession
from app.models.usuario import Usuario
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/me")
async def get_me(usuario_id: CurrentUserID, db: DBSession):
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return {
        "id": str(usuario.id),
        "nome": usuario.nome,
        "email": usuario.email,
        "plano": usuario.plano,
        "email_verificado": usuario.email_verificado,
        "criado_em": usuario.criado_em,
    }
