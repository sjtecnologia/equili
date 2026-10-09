from typing import Annotated, Optional
from uuid import UUID

from app.core import planos as planos_core
from app.core.dependencies import CurrentAdmin, CurrentUserID, DBSession
from app.core.security import get_password_hash, verify_password
from app.models.conta import Alerta, ContaFixa
from app.models.conta_bancaria import CartaoCredito, ContaBancaria
from app.models.conta_lancamento import ContaAPagar, ContaAReceber
from app.models.divida import Divida, DividaPagamento
from app.models.investimento import Investimento
from app.models.lancamento_cartao import LancamentoCartao
from app.models.lancamento_conta import LancamentoConta
from app.models.listas import ItemCompra, Tarefa
from app.models.nfs_recebida import NfsRecebida
from app.models.plano_acao import PlanoAcao
from app.models.push_subscription import PushSubscription
from app.models.renda import Renda
from app.models.sessao import Sessao
from app.models.uso_ia import UsoIA
from app.models.usuario import Usuario
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, select

router = APIRouter()
PLANOS_VALIDOS = tuple(planos_core.PLANOS_VALIDOS)


class PlanoUpdateRequest(BaseModel):
    plano: str


class UsuarioAtivoUpdateRequest(BaseModel):
    ativo: bool


def _usuario_admin_response(usuario: Usuario) -> dict:
    return {
        "id": str(usuario.id),
        "nome": usuario.nome,
        "email": usuario.email,
        "plano": usuario.plano,
        "is_admin": usuario.is_admin,
        "ativo": usuario.ativo,
        "criado_em": usuario.criado_em,
    }


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
        "is_admin": usuario.is_admin,
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
        "is_admin": usuario.is_admin,
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


@router.get("/admin/usuarios")
async def listar_usuarios_admin(_: Annotated[UUID, Depends(CurrentAdmin)], db: DBSession):
    result = await db.execute(select(Usuario).order_by(Usuario.criado_em))
    return [_usuario_admin_response(u) for u in result.scalars()]


@router.patch("/admin/usuarios/{usuario_id}/plano")
async def atualizar_plano_admin(
    usuario_id: UUID,
    data: PlanoUpdateRequest,
    _: Annotated[UUID, Depends(CurrentAdmin)],
    db: DBSession,
):
    if data.plano not in PLANOS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Plano inválido. Use: {', '.join(PLANOS_VALIDOS)}",
        )
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    usuario.plano = data.plano
    await db.commit()
    await db.refresh(usuario)
    return {"id": str(usuario.id), "plano": usuario.plano}


@router.patch("/admin/usuarios/{usuario_id}/ativo")
async def atualizar_usuario_ativo_admin(
    usuario_id: UUID,
    data: UsuarioAtivoUpdateRequest,
    admin_id: Annotated[UUID, Depends(CurrentAdmin)],
    db: DBSession,
):
    if usuario_id == admin_id:
        raise HTTPException(
            status_code=400,
            detail="Você não pode desativar seu próprio usuário.",
        )

    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    usuario.ativo = data.ativo
    await db.commit()
    await db.refresh(usuario)
    return _usuario_admin_response(usuario)


@router.delete("/admin/usuarios/{usuario_id}", status_code=204)
async def excluir_usuario_admin(
    usuario_id: UUID,
    admin_id: Annotated[UUID, Depends(CurrentAdmin)],
    db: DBSession,
):
    if usuario_id == admin_id:
        raise HTTPException(
            status_code=400,
            detail="Você não pode excluir seu próprio usuário.",
        )

    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    try:
        conta_ids = select(ContaBancaria.id).where(ContaBancaria.usuario_id == usuario_id)
        cartao_ids = select(CartaoCredito.id).where(CartaoCredito.usuario_id == usuario_id)

        await db.execute(delete(LancamentoConta).where(LancamentoConta.conta_bancaria_id.in_(conta_ids)))
        await db.execute(delete(LancamentoCartao).where(LancamentoCartao.cartao_credito_id.in_(cartao_ids)))

        for model in (
            ContaAPagar,
            ContaAReceber,
            DividaPagamento,
            ContaFixa,
            Alerta,
            Divida,
            Renda,
            PlanoAcao,
            Investimento,
            ContaBancaria,
            CartaoCredito,
            Tarefa,
            ItemCompra,
            PushSubscription,
            Sessao,
            UsoIA,
        ):
            await db.execute(delete(model).where(model.usuario_id == usuario_id))

        await db.execute(delete(NfsRecebida).where(NfsRecebida.user_id == usuario_id))
        await db.delete(usuario)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Não foi possível mapear todas as relações com segurança. Desative o usuário em vez de excluir.",
        ) from exc
