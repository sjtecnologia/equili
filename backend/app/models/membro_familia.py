"""
Membros da família — convites e vínculos de multi-usuário sob 1 assinatura Pro.

O **titular** (dono da assinatura Pro) convida por e-mail; o **membro** aceita
com um token. Cada membro mantém login e dados próprios; o plano do grupo é
determinado pela assinatura do titular.

Status:
- ``pendente`` — convite criado, aguardando aceite;
- ``ativo`` — membro aceitou e faz parte do grupo;
- ``cancelado`` — convite revogado pelo titular;
- ``saiu`` — membro saiu ou foi removido (histórico, não conta nas vagas).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

STATUS_PENDENTE = "pendente"
STATUS_ATIVO = "ativo"
STATUS_CANCELADO = "cancelado"
STATUS_SAIU = "saiu"


class MembroFamilia(Base):
    __tablename__ = "membros_familia"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    titular_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    membro_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=STATUS_PENDENTE
    )
    token: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    plano_original: Mapped[str | None] = mapped_column(String(20), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    aceito_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    titular: Mapped["Usuario"] = relationship(  # noqa: F821
        foreign_keys=[titular_id], back_populates="familia_como_titular"
    )
    membro: Mapped["Usuario | None"] = relationship(  # noqa: F821
        foreign_keys=[membro_id], back_populates="familia_como_membro"
    )