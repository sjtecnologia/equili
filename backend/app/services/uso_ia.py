"""Contadores mensais de uso de IA (cotas por plano)."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.uso_ia import UsoIA


def periodo_atual() -> str:
    """Período no formato ``YYYY-MM`` (UTC)."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def contar_uso(
    db: AsyncSession, usuario_id: UUID, recurso: str, periodo: str | None = None
) -> int:
    periodo = periodo or periodo_atual()
    valor = await db.scalar(
        select(UsoIA.contador).where(
            UsoIA.usuario_id == usuario_id,
            UsoIA.recurso == recurso,
            UsoIA.periodo == periodo,
        )
    )
    return int(valor or 0)


async def registrar_uso(
    db: AsyncSession, usuario_id: UUID, recurso: str, periodo: str | None = None
) -> int:
    """Incrementa o contador do período e retorna o novo valor."""
    periodo = periodo or periodo_atual()
    registro = await db.scalar(
        select(UsoIA).where(
            UsoIA.usuario_id == usuario_id,
            UsoIA.recurso == recurso,
            UsoIA.periodo == periodo,
        )
    )
    if registro is None:
        registro = UsoIA(usuario_id=usuario_id, recurso=recurso, periodo=periodo, contador=1)
        db.add(registro)
    else:
        registro.contador += 1
    await db.commit()
    return int(registro.contador)
