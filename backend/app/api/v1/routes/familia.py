"""
Família / multi-usuário — convites do titular da assinatura Pro e membros com
conta própria (dados separados por usuário, 1 assinatura paga pelo titular).

Sem o plano Pro (recurso ``multiusuario``) convites respondem **402**; cota de
membros cheia responde **429** — mesmas convenções do restante do app.
"""
from datetime import datetime, timezone
from secrets import token_urlsafe
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select

from app.core import planos as planos_core
from app.core.config import settings
from app.core.dependencies import CurrentUserID, DBSession
from app.models.membro_familia import (
    STATUS_ATIVO,
    STATUS_CANCELADO,
    STATUS_PENDENTE,
    STATUS_SAIU,
    MembroFamilia,
)
from app.models.usuario import Usuario
from app.services import familia as familia_service

router = APIRouter(tags=["Família"])

LIMITE_MEMBROS_KEY = planos_core.LIMITE_MEMBROS
RECURSO_MULTIUSUARIO = planos_core.RECURSO_MULTIUSUARIO


class ConvitePayload(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def email_valido(cls, v: str) -> str:
        email = (v or "").strip().lower()
        if len(email) > 255 or "@" not in email or "." not in email.split("@")[-1]:
            raise ValueError("E-mail inválido.")
        return email


class AceitarPayload(BaseModel):
    token: str


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _convite_dict(linha: MembroFamilia, com_token: bool = False) -> dict:
    return {
        "id": str(linha.id),
        "email": linha.email,
        "status": linha.status,
        "criado_em": linha.criado_em.isoformat() if linha.criado_em else None,
        "token": linha.token if com_token else None,
    }


def _membro_dict(linha: MembroFamilia, nomes: dict) -> dict:
    return {
        "id": str(linha.id),
        "email": linha.email,
        "nome": nomes.get(linha.membro_id),
        "status": linha.status,
        "aceito_em": linha.aceito_em.isoformat() if linha.aceito_em else None,
        "criado_em": linha.criado_em.isoformat() if linha.criado_em else None,
    }


async def _buscador_nomes(db, ids: list) -> dict:
    ids_validos = [i for i in set(ids) if i]
    if not ids_validos:
        return {}
    usuarios = (
        await db.scalars(select(Usuario).where(Usuario.id.in_(ids_validos)))
    ).all()
    return {u.id: u.nome for u in usuarios}


def _enviar_email_convite(email: str, token: str, titular_nome: str) -> None:
    """Notifica o convidado por e-mail (opcional — funciona sem Resend em dev)."""
    link = f"{settings.FRONTEND_URL.rstrip('/')}/familia?convite={token}"
    if not settings.RESEND_API_KEY:
        return
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": settings.EMAIL_FROM,
                "to": [email],
                "subject": f"{titular_nome} convidou você para a família no Equili",
                "html": (
                    "<p>Olá! Você foi convidado para organizar a vida financeira"
                    " em família no <strong>Equili</strong>.</p>"
                    f"<p><a href=\"{link}\">Aceitar convite</a></p>"
                    "<p>Se você ainda não tem conta, crie uma com o mesmo e-mail de "
                    "deste convite e depois aceite pelo link acima.</p>"
                    "<p>Se não conhece o remetente, pode ignorar este e-mail.</p>"
                ),
            }
        )
    except Exception:  # noqa: BLE001 - envio de e-mail não deve quebrar o convite
        pass


# ─── Rotas ───────────────────────────────────────────────────────────────────


@router.get("")
async def minha_familia(usuario_id: CurrentUserID, db: DBSession):
    """Contexto de família do usuário logado."""
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    limite_membros = planos_core.limite(usuario.plano, LIMITE_MEMBROS_KEY)
    pode_convidar = planos_core.tem_recurso(usuario.plano, RECURSO_MULTIUSUARIO)

    # 1) Sou membro ativo de uma família?
    linha_membro = await familia_service.linha_ativa_de_membro(db, usuario_id)
    if linha_membro:
        titular = await db.get(Usuario, linha_membro.titular_id)
        linhas = await db.scalars(
            select(MembroFamilia).where(
                MembroFamilia.titular_id == linha_membro.titular_id,
                MembroFamilia.status.in_((STATUS_PENDENTE, STATUS_ATIVO)),
            )
        )
        linhas = [l for l in linhas]
        nomes = await _buscador_nomes(db, [l.membro_id for l in linhas if l.membro_id])
        return {
            "papel": "membro",
            "titular": (
                {"id": str(titular.id), "nome": titular.nome, "email": titular.email}
                if titular
                else None
            ),
            "convites": [_convite_dict(l) for l in linhas if l.status == STATUS_PENDENTE],
            "membros": [_membro_dict(l, nomes) for l in linhas if l.status == STATUS_ATIVO],
            "limite_membros": limite_membros,
            "vagas": max(limite_membros - len(linhas), 0) if limite_membros else None,
            "pode_convidar": False,
        }

    # 2) Sou titular (tenho convites/membros) ou tenho o Pro ativo?
    linhas = (
        await db.scalars(
            select(MembroFamilia).where(
                MembroFamilia.titular_id == usuario_id,
                MembroFamilia.status.in_((STATUS_PENDENTE, STATUS_ATIVO)),
            )
        )
    ).all()
    if linhas or pode_convidar:
        nomes = await _buscador_nomes(db, [l.membro_id for l in linhas if l.membro_id])
        convites = [l for l in linhas if l.status == STATUS_PENDENTE]
        membros = [l for l in linhas if l.status == STATUS_ATIVO]
        return {
            "papel": "titular",
            "titular": {
                "id": str(usuario.id),
                "nome": usuario.nome,
                "email": usuario.email,
            },
            "convites": [_convite_dict(c, com_token=True) for c in convites],
            "membros": [_membro_dict(m, nomes) for m in membros],
            "limite_membros": limite_membros,
            "vagas": max(limite_membros - len(linhas), 0) if limite_membros else None,
            "pode_convidar": True,
        }

    # 3) Tenho convite pendente para o meu e-mail?
    convite = await db.scalar(
        select(MembroFamilia).where(
            MembroFamilia.email == usuario.email,
            MembroFamilia.status == STATUS_PENDENTE,
        )
    )
    if convite:
        titular = await db.get(Usuario, convite.titular_id)
        return {
            "papel": "convidado",
            "titular": (
                {"id": str(titular.id), "nome": titular.nome, "email": titular.email}
                if titular
                else None
            ),
            "convite": _convite_dict(convite, com_token=True),
            "limite_membros": limite_membros,
            "vagas": None,
            "pode_convidar": False,
        }

    return {
        "papel": "nenhum",
        "titular": None,
        "convites": [],
        "membros": [],
        "convite": None,
        "limite_membros": limite_membros,
        "vagas": None,
        "pode_convidar": False,
    }


@router.post("/convites", status_code=status.HTTP_201_CREATED)
async def convidar_membro(
    payload: ConvitePayload, usuario_id: CurrentUserID, db: DBSession
):
    """Titular (plano Pro ativo) convida alguém pelo e-mail."""
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if not planos_core.tem_recurso(usuario.plano, RECURSO_MULTIUSUARIO):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Convidar membros faz parte do plano Pro / Família. Faça upgrade e tente de novo.",
        )

    if await familia_service.linha_ativa_de_membro(db, usuario_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você participa da família de outra pessoa; só o titular pode convidar membros.",
        )

    if payload.email == usuario.email.lower():
        raise HTTPException(status_code=400, detail="Você não pode convidar a si mesmo.")

    # Não reenviar convite para e-mail que já ocupa vaga do mesmo titular.
    existente = await db.scalar(
        select(MembroFamilia).where(
            MembroFamilia.titular_id == usuario_id,
            MembroFamilia.email == payload.email,
            MembroFamilia.status.in_((STATUS_PENDENTE, STATUS_ATIVO)),
        )
    )
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está na sua família (convite pendente ou membro ativo).",
        )

    limite_membros = planos_core.limite(usuario.plano, LIMITE_MEMBROS_KEY)
    ocupadas = await familia_service.vagas_ocupadas(db, usuario_id)
    if limite_membros is not None and ocupadas >= limite_membros:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Limite atingido — sua família comporta até {limite_membros} membros.",
        )

    linha = MembroFamilia(
        titular_id=usuario_id,
        email=payload.email,
        status=STATUS_PENDENTE,
        token=token_urlsafe(32),
    )
    db.add(linha)
    await db.commit()
    await db.refresh(linha)

    _enviar_email_convite(payload.email, linha.token, usuario.nome)

    return {
        "convite": _convite_dict(linha, com_token=True),
        "limite_membros": limite_membros,
        "vagas": max(limite_membros - ocupadas - 1, 0) if limite_membros else None,
    }


@router.post("/convites/{convite_id}/cancelar")
async def cancelar_convite(convite_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    """Titular revoga um convite pendente."""
    linha = await db.get(MembroFamilia, convite_id)
    if not linha or linha.titular_id != usuario_id or linha.status != STATUS_PENDENTE:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")

    linha.status = STATUS_CANCELADO
    await db.commit()
    return {"status": "cancelado", "id": str(linha.id)}


@router.post("/membros/{membro_id}/remover")
async def remover_membro(membro_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    """Titular remove um membro ativo; o plano dele volta ao de antes."""
    linha = await db.get(MembroFamilia, membro_id)
    if not linha or linha.titular_id != usuario_id or linha.status != STATUS_ATIVO:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")

    await familia_service.restaurar_plano_membro(db, linha)
    linha.status = STATUS_SAIU
    await db.commit()
    return {"status": "removido", "id": str(linha.id)}


@router.post("/aceitar")
async def aceitar_convite(
    payload: AceitarPayload, usuario_id: CurrentUserID, db: DBSession
):
    """Convidado logado (mesmo e-mail do convite) entra para a família."""
    usuario = await db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    linha = await db.scalar(
        select(MembroFamilia).where(
            MembroFamilia.token == payload.token,
            MembroFamilia.status == STATUS_PENDENTE,
        )
    )
    if not linha:
        raise HTTPException(
            status_code=404, detail="Convite inválido, expirado ou já utilizado."
        )

    if linha.email != usuario.email.lower():
        raise HTTPException(
            status_code=400,
            detail="Este convite é para outro e-mail. Entre com a conta do e-mail convidado.",
        )

    # Um usuário só participa de uma família por vez.
    outra = await familia_service.linha_ativa_de_membro(db, usuario_id)
    if outra:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você já faz parte de outra família.",
        )
    como_titular = await db.scalar(
        select(MembroFamilia).where(
            MembroFamilia.titular_id == usuario_id,
            MembroFamilia.status.in_((STATUS_PENDENTE, STATUS_ATIVO)),
        )
    )
    if como_titular:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você é dono(a) de uma família e não pode aceitar convite de outra.",
        )

    linha.plano_original = usuario.plano
    linha.membro_id = usuario.id
    linha.status = STATUS_ATIVO
    linha.aceito_em = datetime.now(timezone.utc)
    usuario.plano = planos_core.PLANO_PRO
    await db.commit()

    return {"status": "aceito", "familia": True}


@router.post("/sair")
async def sair_da_familia(usuario_id: CurrentUserID, db: DBSession):
    """Membro sai do grupo; o plano volta ao que tinha antes (ou ao da assinatura própria)."""
    linha = await familia_service.linha_ativa_de_membro(db, usuario_id)
    if not linha:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você não participa de nenhuma família.",
        )

    await familia_service.restaurar_plano_membro(db, linha)
    linha.status = STATUS_SAIU
    await db.commit()
    return {"status": "saiu", "id": str(linha.id)}