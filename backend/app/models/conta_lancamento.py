import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ContaAPagar(Base):
    """Lançamento individual de conta a pagar (histórico + futuros).

    Pode estar vinculado a uma ContaFixa (template de recorrência)
    para rastrear de onde o lançamento foi gerado.
    """

    __tablename__ = "contas_a_pagar"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Vínculo opcional com o template de recorrência
    conta_fixa_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contas_fixas.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    descricao: Mapped[str] = mapped_column(String(150), nullable=False)
    categoria: Mapped[str] = mapped_column(String(50), nullable=False)
    # moradia | transporte | saude | educacao | alimentacao | lazer | outro
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    data_vencimento: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pendente")
    # pendente | pago | vencido
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="avulsa")
    # fixa | variavel | avulsa
    pago_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="contas_a_pagar")  # noqa: F821
    conta_fixa: Mapped["ContaFixa | None"] = relationship()  # noqa: F821


class ContaAReceber(Base):
    """Lançamento individual de conta a receber (histórico + futuros).

    Pode estar vinculado a uma Renda (template de recorrência)
    para rastrear salários, freelas recorrentes, etc.
    """

    __tablename__ = "contas_a_receber"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Vínculo opcional com a fonte de renda recorrente
    renda_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rendas.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    descricao: Mapped[str] = mapped_column(String(150), nullable=False)
    origem: Mapped[str] = mapped_column(String(30), nullable=False)
    # salario | freela | venda | emprestimo | outro
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, server_default="avulsa")
    # recorrente | parcelada | avulsa
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    data_prevista: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pendente")
    # pendente | recebido | atrasado
    devedor: Mapped[str | None] = mapped_column(String(150), nullable=True)
    recebido_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="contas_a_receber")  # noqa: F821
    renda: Mapped["Renda | None"] = relationship()  # noqa: F821
