import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ContaBancaria(Base):
    __tablename__ = "contas_bancarias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    banco: Mapped[str] = mapped_column(String(80), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)  # corrente | poupanca | investimento | digital
    saldo_inicial: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    cor: Mapped[str] = mapped_column(String(20), nullable=False, default="#2E7D5E")
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    usuario: Mapped["Usuario"] = relationship(back_populates="contas_bancarias")  # noqa: F821


class CartaoCredito(Base):
    __tablename__ = "cartoes_credito"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    bandeira: Mapped[str] = mapped_column(String(30), nullable=False)  # visa | mastercard | elo | amex | hipercard | outro
    limite: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    dia_fechamento: Mapped[int] = mapped_column(Integer, nullable=False)
    dia_vencimento: Mapped[int] = mapped_column(Integer, nullable=False)
    cor: Mapped[str] = mapped_column(String(20), nullable=False, default="#1A3C5E")
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    usuario: Mapped["Usuario"] = relationship(back_populates="cartoes_credito")  # noqa: F821
