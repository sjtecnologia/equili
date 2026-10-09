import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UsoIA(Base):
    """Contador mensal de uso de recursos de IA por usuário.

    Usado para aplicar cotas do plano (ex.: mensagens de chat por mês) sem
    precisar armazenar o histórico da conversa.
    """

    __tablename__ = "uso_ia"
    __table_args__ = (
        UniqueConstraint(
            "usuario_id", "recurso", "periodo", name="uq_uso_ia_usuario_recurso_periodo"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recurso: Mapped[str] = mapped_column(String(30), nullable=False)
    periodo: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    contador: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
