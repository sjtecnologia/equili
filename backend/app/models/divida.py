import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Divida(Base):
    __tablename__ = "dividas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    descricao: Mapped[str] = mapped_column(String(150), nullable=False)
    credor: Mapped[str | None] = mapped_column(String(150), nullable=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    # cartao_parcelado | emprestimo | financiamento | cheque_pre | outro
    valor_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    valor_parcela: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    parcelas_restantes: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    taxa_juros_mensal: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    data_inicio_contrato: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_primeira_parcela: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_prox_vencimento: Mapped[date] = mapped_column(Date, nullable=False)
    quitada: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    usuario: Mapped["Usuario"] = relationship(back_populates="dividas")  # noqa: F821
    pagamentos: Mapped[list["DividaPagamento"]] = relationship(
        back_populates="divida",
        cascade="all, delete-orphan",
        order_by="DividaPagamento.data_referencia.desc()",
    )


class DividaPagamento(Base):
    __tablename__ = "divida_pagamentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    divida_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dividas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # data_referencia: o período da parcela que foi quitada (ex: 2026-03)
    data_referencia: Mapped[date] = mapped_column(Date, nullable=False)
    # data_pagamento: data real em que o pagamento foi efetuado
    data_pagamento: Mapped[date] = mapped_column(Date, nullable=False)
    valor_pago: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    valor_parcela_original: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    observacao: Mapped[str | None] = mapped_column(String(300), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    divida: Mapped["Divida"] = relationship(back_populates="pagamentos")
