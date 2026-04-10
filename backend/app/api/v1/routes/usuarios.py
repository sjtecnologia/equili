from typing import Optional

from app.core.dependencies import CurrentUserID, DBSession
from app.core.security import get_password_hash, verify_password
from app.models.usuario import Usuario
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

router = APIRouter()


class UpdatePerfilRequest(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    senha_atual: Optional[str] = None
    nova_senha: Optional[str] = None


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


@router.put("/me")
async def update_me(data: UpdatePerfilRequest, usuario_id: CurrentUserID, db: DBSession):
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if data.nome is not None:
        usuario.nome = data.nome

    if data.email is not None and data.email != usuario.email:
        from sqlalchemy import select
        existing = await db.scalar(
            select(Usuario).where(Usuario.email == data.email)
        )
        if existing:
            raise HTTPException(status_code=409, detail="Este e-mail já está em uso.")
        usuario.email = data.email

    if data.nova_senha is not None:
        if not data.senha_atual:
            raise HTTPException(status_code=400, detail="Informe a senha atual para alterá-la.")
        if not verify_password(data.senha_atual, usuario.senha_hash):
            raise HTTPException(status_code=400, detail="Senha atual incorreta.")
        if len(data.nova_senha) < 8:
            raise HTTPException(status_code=400, detail="Nova senha deve ter no mínimo 8 caracteres.")
        usuario.senha_hash = get_password_hash(data.nova_senha)

    await db.commit()
    await db.refresh(usuario)
    return {
        "id": str(usuario.id),
        "nome": usuario.nome,
        "email": usuario.email,
        "plano": usuario.plano,
        "email_verificado": usuario.email_verificado,
        "criado_em": usuario.criado_em,
    }


class UpdateTelefoneRequest(BaseModel):
    telefone: Optional[str] = None  # None para remover


@router.put("/me/telefone")
async def update_telefone(data: UpdateTelefoneRequest, usuario_id: CurrentUserID, db: DBSession):
    """Salva ou remove o número de telefone para uso no bot WhatsApp."""
    from sqlalchemy import select

    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if data.telefone:
        tel = data.telefone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        existing = await db.scalar(
            select(Usuario).where(Usuario.telefone == tel, Usuario.id != usuario_id)
        )
        if existing:
            raise HTTPException(status_code=409, detail="Este número já está vinculado a outra conta.")
        usuario.telefone = tel
    else:
        usuario.telefone = None

    await db.commit()
    return {"telefone": usuario.telefone}