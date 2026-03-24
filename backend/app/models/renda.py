import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Renda(Base):
    __tablename__ = "rendas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    descricao: Mapped[str] = mapped_column(String(150), nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    frequencia: Mapped[str] = mapped_column(String(20), nullable=False)  # mensal | quinzenal | semanal
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)  # salario | freela | aluguel | outro
    ativo: Mapped[bool] = mapped_column(default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    usuario: Mapped["Usuario"] = relationship(back_populates="rendas")  # noqa: F821
