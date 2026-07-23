from typing import Optional

from app.core.dependencies import CurrentUserID, DBSession
from app.core.security import get_password_hash, verify_password
from app.models.usuario import Usuario
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

router = APIRouter()


class UpdatePerfilRequest(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    senha_atual: Optional[str] = Field(default=None, min_length=1, max_length=128)
    nova_senha: Optional[str] = Field(default=None, min_length=8, max_length=128)


class DeleteContaRequest(BaseModel):
    senha: str = Field(min_length=1, max_length=128)
    confirmacao: str = Field(min_length=1, max_length=64)  # deve ser igual a "EXCLUIR MINHA CONTA"


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


# ─── LGPD: Exportação de dados pessoais ──────────────────────────────────────

@router.get("/me/exportar-dados")
async def exportar_dados(usuario_id: CurrentUserID, db: DBSession):
    """
    Art. 18, V LGPD — Direito de acesso/portabilidade dos dados pessoais.
    Retorna todos os dados do usuário em JSON estruturado.
    """
    from app.models.renda import Renda
    from app.models.divida import Divida
    from app.models.conta_lancamento import ContaAPagar, ContaAReceber
    from app.models.investimento import Investimento

    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    rendas = (await db.execute(select(Renda).where(Renda.usuario_id == usuario_id))).scalars().all()
    dividas = (await db.execute(select(Divida).where(Divida.usuario_id == usuario_id))).scalars().all()
    pagar = (await db.execute(select(ContaAPagar).where(ContaAPagar.usuario_id == usuario_id))).scalars().all()
    receber = (await db.execute(select(ContaAReceber).where(ContaAReceber.usuario_id == usuario_id))).scalars().all()
    investimentos = (await db.execute(select(Investimento).where(Investimento.usuario_id == usuario_id))).scalars().all()

    return {
        "aviso_lgpd": "Exportação de dados pessoais conforme Art. 18 da LGPD (Lei 13.709/2018).",
        "exportado_em": __import__('datetime').datetime.utcnow().isoformat() + "Z",
        "perfil": {
            "id": str(usuario.id),
            "nome": usuario.nome,
            "email": usuario.email,
            "telefone": usuario.telefone,
            "criado_em": usuario.criado_em.isoformat() if usuario.criado_em else None,
        },
        "rendas": [
            {"descricao": r.descricao, "tipo": r.tipo, "valor": float(r.valor), "frequencia": r.frequencia}
            for r in rendas
        ],
        "dividas": [
            {"descricao": d.descricao, "credor": d.credor, "tipo": d.tipo,
             "valor_total": float(d.valor_total), "quitada": d.quitada}
            for d in dividas
        ],
        "contas_a_pagar": [
            {"descricao": c.descricao, "categoria": c.categoria, "valor": float(c.valor),
             "data_vencimento": c.data_vencimento.isoformat(), "status": c.status}
            for c in pagar
        ],
        "contas_a_receber": [
            {"descricao": c.descricao, "origem": c.origem, "valor": float(c.valor),
             "data_prevista": c.data_prevista.isoformat(), "status": c.status}
            for c in receber
        ],
        "investimentos": [
            {"descricao": i.descricao, "tipo": i.tipo, "valor_investido": float(i.valor_investido)}
            for i in investimentos
        ],
    }


# ─── LGPD: Exclusão de conta ─────────────────────────────────────────────────

@router.delete("/me", status_code=204)
async def excluir_conta(
    data: DeleteContaRequest,
    usuario_id: CurrentUserID,
    db: DBSession,
    response: Response,
):
    """
    Art. 18, VI LGPD — Direito de eliminação dos dados pessoais.
    Exige confirmação de senha e texto explícito "EXCLUIR MINHA CONTA".
    Apaga o usuário e todos os dados vinculados (cascade).
    """
    if data.confirmacao != "EXCLUIR MINHA CONTA":
        raise HTTPException(
            status_code=400,
            detail='Para confirmar, escreva exatamente: EXCLUIR MINHA CONTA',
        )

    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Usuários sociais (Google/Apple) não têm senha — aceitamos sem verificação de senha
    if usuario.senha_hash and not usuario.google_id and not usuario.apple_id:
        if not verify_password(data.senha, usuario.senha_hash):
            raise HTTPException(status_code=400, detail="Senha incorreta.")

    await db.delete(usuario)
    await db.commit()

    # Apaga o cookie de refresh
    response.delete_cookie("refresh_token")
    return None
