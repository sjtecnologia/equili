import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Meta(Base):
    """Meta financeira — objetivo de poupança com valor alvo e progresso.

    O plano do usuário limita a quantidade de metas ativas
    (grátis = 1, Premium/Pro = ilimitado).
    """

    __tablename__ = "metas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    titulo: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    categoria: Mapped[str | None] = mapped_column(String(50), nullable=True)
    valor_alvo: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    valor_atual: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    prazo: Mapped[date | None] = mapped_column(Date, nullable=True)
    concluida: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="metas")  # noqa: F821