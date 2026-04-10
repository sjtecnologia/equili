import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Investimento(Base):
    """Posição de investimento de um usuário."""
    __tablename__ = "investimentos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)

    nome = Column(String(150), nullable=False)           # Ex: "IVVB11", "CDB Banco XYZ", "Tesouro IPCA+ 2029"
    tipo = Column(String(50), nullable=False)             # acoes, fii, renda_fixa, criptomoeda, tesouro, outro
    instituicao = Column(String(100), nullable=True)      # Nubank, XP, Itaú...

    quantidade = Column(Numeric(18, 6), nullable=True)    # Para ativos com quantidade (ações, FIIs, cripto)
    preco_medio = Column(Numeric(18, 2), nullable=True)   # Preço médio de compra por unidade
    valor_investido = Column(Numeric(18, 2), nullable=False)  # Total aportado
    valor_atual = Column(Numeric(18, 2), nullable=False)      # Valor atual estimado
    data_aplicacao = Column(Date, nullable=False, default=date.today)

    observacao = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="investimentos")

    @property
    def rentabilidade_pct(self) -> float:
        if not self.valor_investido or float(self.valor_investido) == 0:
            return 0.0
        return ((float(self.valor_atual) - float(self.valor_investido)) / float(self.valor_investido)) * 100
