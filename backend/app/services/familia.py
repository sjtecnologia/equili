"""
Serviço de família — regras de vínculo entre o titular da assinatura Pro e os
membros convidados.

O plano do grupo vive na assinatura do titular; o ``usuario.plano`` de cada
membro é um espelho disso (Pro enquanto membro ativo). As funções abaixo
promovem/revertem esse espelho nos pontos de mutação (aceite, saída, remoção,
pagamento do titular, cancelamento) — sempre respeitando assinatura própria do
membro, para não rebaixar quem paga um plano por conta própria.
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import planos as planos_core
from app.models.assinatura import Assinatura
from app.models.membro_familia import (
    STATUS_ATIVO,
    STATUS_PENDENTE,
    MembroFamilia,
)
from app.models.usuario import Usuario

STATUS_OCUPANDO_VAGA = (STATUS_PENDENTE, STATUS_ATIVO)


async def vagas_ocupadas(db: AsyncSession, titular_id) -> int:
    """Quantas vagas estão ocupadas (convites pendentes + membros ativos)."""
    total = await db.scalar(
        select(func.count()).where(
            MembroFamilia.titular_id == titular_id,
            MembroFamilia.status.in_(STATUS_OCUPANDO_VAGA),
        )
    )
    return int(total or 0)


async def membros_ativos(db: AsyncSession, titular_id) -> list[MembroFamilia]:
    """Linhas ativas (membros que aceitaram o convite)."""
    return (
        await db.scalars(
            select(MembroFamilia).where(
                MembroFamilia.titular_id == titular_id,
                MembroFamilia.status == STATUS_ATIVO,
            )
        )
    ).all()


async def linha_ativa_de_membro(db: AsyncSession, membro_id) -> MembroFamilia | None:
    """Linha ativa em que o usuário é membro (uma família por usuário)."""
    return await db.scalar(
        select(MembroFamilia).where(
            MembroFamilia.membro_id == membro_id,
            MembroFamilia.status == STATUS_ATIVO,
        )
    )


async def promover_para_pro(db: AsyncSession, linha: MembroFamilia) -> None:
    """Sincroniza o plano do membro para Pro (reflete a assinatura do titular)."""
    if not linha.membro_id:
        return
    usuario = await db.get(Usuario, linha.membro_id)
    if usuario and usuario.plano != planos_core.PLANO_PRO:
        usuario.plano = planos_core.PLANO_PRO


async def restaurar_plano_membro(db: AsyncSession, linha: MembroFamilia) -> None:
    """Reverte o plano do membro após sair/remoção.

    Se o membro tiver assinatura própria ativa, volta para o plano dela;
    caso contrário, para o ``plano_original`` registrado no aceite.
    """
    if not linha.membro_id:
        return
    usuario = await db.get(Usuario, linha.membro_id)
    if not usuario:
        return
    assinatura = await db.scalar(
        select(Assinatura).where(
            Assinatura.usuario_id == linha.membro_id,
            Assinatura.status == "ativa",
        )
    )
    if assinatura:
        usuario.plano = planos_core.normalizar_plano(assinatura.plano)
    else:
        usuario.plano = planos_core.normalizar_plano(
            linha.plano_original or planos_core.PLANO_GRATUITO
        )


async def rebaixar_todos_membros(db: AsyncSession, titular_id) -> int:
    """Rebaixa todos os membros ativos do titular (ex.: assinatura cancelada)."""
    linhas = await membros_ativos(db, titular_id)
    for linha in linhas:
        await restaurar_plano_membro(db, linha)
    return len(linhas)