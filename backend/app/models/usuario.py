import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    apple_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    telefone: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True, index=True)
    plano: Mapped[str] = mapped_column(String(20), nullable=False, default="gratuito")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verificado: Mapped[bool] = mapped_column(Boolean, default=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relacionamentos
    rendas: Mapped[list["Renda"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    dividas: Mapped[list["Divida"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    planos_acao: Mapped[list["PlanoAcao"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    contas_fixas: Mapped[list["ContaFixa"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    alertas: Mapped[list["Alerta"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    contas_a_pagar: Mapped[list["ContaAPagar"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    contas_a_receber: Mapped[list["ContaAReceber"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    push_subscriptions: Mapped[list["PushSubscription"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    investimentos: Mapped[list["Investimento"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    contas_bancarias: Mapped[list["ContaBancaria"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    cartoes_credito: Mapped[list["CartaoCredito"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    tarefas: Mapped[list["Tarefa"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    itens_compra: Mapped[list["ItemCompra"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    sessoes: Mapped[list["Sessao"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    notas_fiscais: Mapped[list["NfsRecebida"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
    metas: Mapped[list["Meta"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")  # noqa: F821
