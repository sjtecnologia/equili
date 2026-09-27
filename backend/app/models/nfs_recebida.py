import uuid
from datetime import datetime

from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NfsRecebida(Base):
    __tablename__ = "nfs_recebidas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    numero: Mapped[str] = mapped_column(String(50), nullable=False)
    serie: Mapped[str | None] = mapped_column(String(20), nullable=True)
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    chave_acesso: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    codigo_verificacao: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cpf_cnpj: Mapped[str | None] = mapped_column(String(30), nullable=True)
    inscricao_municipal: Mapped[str | None] = mapped_column(String(50), nullable=True)
    url_consulta: Mapped[str | None] = mapped_column(String(500), nullable=True)
    data_emissao: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    usuario: Mapped["Usuario"] = relationship(back_populates="notas_fiscais")  # noqa: F821
