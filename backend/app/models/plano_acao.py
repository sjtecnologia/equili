import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PlanoAcao(Base):
    __tablename__ = "planos_acao"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    conteudo: Mapped[dict] = mapped_column(JSONB, nullable=False)
    conteudo_texto: Mapped[str] = mapped_column(Text, nullable=False)
    estrategia: Mapped[str | None] = mapped_column(String(20), nullable=True)  # avalanche | bola_de_neve
    data_livre_prevista: Mapped[date | None] = mapped_column(Date, nullable=True)
    feedback: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 1 | -1
    feedback_texto: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_usados: Mapped[int | None] = mapped_column(Integer, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    usuario: Mapped["Usuario"] = relationship(back_populates="planos_acao")  # noqa: F821
