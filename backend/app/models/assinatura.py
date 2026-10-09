"""
Assinaturas e pagamentos — a cobrança do Equili.

Fluxo: o checkout cria uma ``Assinatura`` (``aguardando_pagamento``) e um
``Pagamento`` (``pendente``). Quando o gateway confirma o pagamento via
webhook, a assinatura vira ``ativa`` e ``usuario.plano`` passa a refletir o
plano pago, liberando os recursos do catálogo.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Assinatura(Base):
    __tablename__ = "assinaturas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plano: Mapped[str] = mapped_column(String(20), nullable=False)  # premium | pro
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="aguardando_pagamento"
    )
    gateway: Mapped[str] = mapped_column(String(30), nullable=False, default="mock")
    gateway_assinatura_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preco_mensal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    data_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_proxima_cobranca: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="assinaturas")  # noqa: F821
    pagamentos: Mapped[list["Pagamento"]] = relationship(
        back_populates="assinatura", cascade="all, delete-orphan"
    )


class Pagamento(Base):
    __tablename__ = "pagamentos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    assinatura_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assinaturas.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plano: Mapped[str] = mapped_column(String(20), nullable=False)
    metodo: Mapped[str] = mapped_column(String(10), nullable=False)  # pix | cartao
    valor: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pendente")
    gateway: Mapped[str] = mapped_column(String(30), nullable=False, default="mock")
    gateway_pagamento_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qr_code: Mapped[str | None] = mapped_column(Text, nullable=True)  # PIX copia-e-cola
    qr_base64: Mapped[str | None] = mapped_column(Text, nullable=True)  # imagem (mock SVG)
    url_pagamento: Mapped[str | None] = mapped_column(Text, nullable=True)
    expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    pago_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    assinatura: Mapped["Assinatura | None"] = relationship(back_populates="pagamentos")  # noqa: F821
    usuario: Mapped["Usuario"] = relationship(back_populates="pagamentos")  # noqa: F821