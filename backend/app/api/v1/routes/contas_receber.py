import logging
from calendar import monthrange
from datetime import date, datetime, timezone
from uuid import UUID

from uuid import UUID as PyUUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_bancaria import ContaBancaria
from app.models.conta_lancamento import ContaAReceber
from app.models.lancamento_conta import LancamentoConta

router = APIRouter()
logger = logging.getLogger(__name__)

STATUS_VALIDOS = {"pendente", "recebido", "atrasado"}
MODALIDADES_VALIDAS = {"avulsa", "recorrente", "parcelada"}


def _add_months(dt: date, months: int) -> date:
    """Soma N meses a uma data, ajustando o dia ao último do mês se necessário."""
    total = dt.month + months
    year = dt.year + (total - 1) // 12
    month = ((total - 1) % 12) + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


class ContaAReceberCreate(BaseModel):
    descricao: str
    origem: str | None = ""
    valor: float
    data_prevista: date
    modalidade: str = "avulsa"  # avulsa | recorrente | parcelada
    numero_parcelas: int | None = None  # obrigatório quando modalidade=parcelada
    devedor: str | None = None
    observacao: str | None = None

    @field_validator("valor")
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Valor deve ser maior que zero.")
        return v

    @field_validator("origem", mode="before")
    @classmethod
    def origem_livre(cls, v) -> str:
        v = "" if v is None else str(v).strip()
        if len(v) > 30:
            raise ValueError("Origem deve ter no máximo 30 caracteres.")
        return v

    @field_validator("modalidade")
    @classmethod
    def modalidade_valida(cls, v: str) -> str:
        if v not in MODALIDADES_VALIDAS:
            raise ValueError("Modalidade inválida. Use: avulsa, recorrente ou parcelada.")
        return v

    @field_validator("numero_parcelas", mode="before")
    @classmethod
    def normaliza_numero_parcelas(cls, v):
        if v in (None, ""):
            return None
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
            try:
                v = float(v)
            except ValueError as exc:
                raise ValueError("Número de parcelas deve ser um inteiro válido.") from exc
        if isinstance(v, float):
            if not v.is_integer():
                raise ValueError("Número de parcelas deve ser um inteiro.")
            v = int(v)
        if isinstance(v, int):
            return v
        raise ValueError("Número de parcelas deve ser um inteiro.")

    @model_validator(mode="after")
    def valida_parcelas(self) -> "ContaAReceberCreate":
        if self.modalidade == "parcelada":
            if self.numero_parcelas is None or self.numero_parcelas < 2:
                raise ValueError("Informe ao menos 2 parcelas para conta parcelada.")
        return self


TIPOS_VALIDOS = {"avulsa", "recorrente", "parcelada"}


class ContaAReceberUpdate(BaseModel):
    descricao: str | None = None
    origem: str | None = None
    valor: float | None = None
    data_prevista: date | None = None
    tipo: str | None = None  # avulsa | recorrente | parcelada
    devedor: str | None = None
    observacao: str | None = None

    @field_validator("origem", mode="before")
    @classmethod
    def origem_livre(cls, v):
        if v is None:
            return None
        v = str(v).strip()
        if len(v) > 30:
            raise ValueError("Origem deve ter no máximo 30 caracteres.")
        return v

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str | None) -> str | None:
        if v is not None and v not in TIPOS_VALIDOS:
            raise ValueError("Tipo inválido. Use: avulsa, recorrente ou parcelada.")
        return v


class ReceberRequest(BaseModel):
    data_recebimento: date | None = None
    conta_bancaria_id: PyUUID | None = None


@router.get("")
async def listar_contas_receber(
    usuario_id: CurrentUserID,
    db: DBSession,
    status: str | None = None,
    mes: int | None = None,
    ano: int | None = None,
    q: str | None = None,
    parcela: int | None = None,
    categoria: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
):
    query = select(ContaAReceber).where(ContaAReceber.usuario_id == usuario_id)
    if status and status in STATUS_VALIDOS:
        query = query.where(ContaAReceber.status == status)
    if categoria and categoria.strip():
        query = query.where(func.lower(func.trim(ContaAReceber.origem)) == categoria.strip().lower())
    if data_inicio:
        query = query.where(ContaAReceber.data_prevista >= data_inicio)
    if data_fim:
        query = query.where(ContaAReceber.data_prevista <= data_fim)
    # Parcela é gravada como "(N/total)" ao final da descrição
    if parcela is not None:
        query = query.where(ContaAReceber.descricao.like(f"%({parcela}/%"))
    if q and q.strip():
        termo = q.strip()
        escaped = termo.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        cond = ContaAReceber.descricao.ilike(f"%{escaped}%", escape="\\")
        if termo.isdigit():
            cond = cond | ContaAReceber.descricao.like(f"%({int(termo)}/%")
        query = query.where(cond)
    if mes and ano:
        from sqlalchemy import extract
        query = query.where(
            extract("month", ContaAReceber.data_prevista) == mes,
            extract("year", ContaAReceber.data_prevista) == ano,
        )
    query = query.order_by(ContaAReceber.data_prevista)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_conta_receber(
    data: ContaAReceberCreate, usuario_id: CurrentUserID, db: DBSession
):
    """
    Cria lançamentos de conta a receber conforme a modalidade:
    - avulsa: 1 lançamento
    - recorrente: 1 lançamento por mês do mês inicial até dezembro do mesmo ano
    - parcelada: 1 lançamento por parcela, mensalmente, com "(N/total)" na descrição
    """
    contas_novas: list[ContaAReceber] = []

    if data.modalidade == "recorrente":
        n_meses = 12 - data.data_prevista.month + 1
        logger.info("Gerando %s lançamentos recorrentes para %s", n_meses, data.descricao)
        for i in range(n_meses):
            conta = ContaAReceber(
                usuario_id=usuario_id,
                descricao=data.descricao,
                origem=data.origem,
                valor=data.valor,
                tipo="recorrente",
                data_prevista=_add_months(data.data_prevista, i),
                devedor=data.devedor,
                observacao=data.observacao,
            )
            db.add(conta)
            contas_novas.append(conta)

    elif data.modalidade == "parcelada":
        n = data.numero_parcelas
        logger.info("Gerando %s parcelas para conta a receber: %s", n, data.descricao)
        for i in range(n):
            conta = ContaAReceber(
                usuario_id=usuario_id,
                descricao=f"{data.descricao} ({i + 1}/{n})",
                origem=data.origem,
                valor=data.valor,
                tipo="parcelada",
                data_prevista=_add_months(data.data_prevista, i),
                devedor=data.devedor,
                observacao=data.observacao,
            )
            db.add(conta)
            contas_novas.append(conta)

    else:  # avulsa
        logger.info("Gerando 1 lançamento avulso para %s", data.descricao)
        conta = ContaAReceber(
            usuario_id=usuario_id,
            descricao=data.descricao,
            origem=data.origem,
            valor=data.valor,
            tipo="avulsa",
            data_prevista=data.data_prevista,
            devedor=data.devedor,
            observacao=data.observacao,
        )
        db.add(conta)
        contas_novas.append(conta)

    if data.modalidade == "parcelada" and len(contas_novas) != data.numero_parcelas:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao gerar todas as parcelas. Nenhuma parcela foi persistida.",
        )

    await db.commit()
    logger.info("Persistência concluída: %s lançamentos criados para usuário %s", len(contas_novas), str(usuario_id))
    for c in contas_novas:
        await db.refresh(c)
    return contas_novas


@router.patch("/{conta_id}")
async def atualizar_conta_receber(
    conta_id: UUID, data: ContaAReceberUpdate, usuario_id: CurrentUserID, db: DBSession
):
    conta = await db.get(ContaAReceber, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(conta, campo, valor)
    await db.commit()
    await db.refresh(conta)
    return conta


@router.patch("/{conta_id}/receber", status_code=status.HTTP_200_OK)
async def marcar_como_recebido(
    conta_id: UUID, usuario_id: CurrentUserID, db: DBSession,
    data: ReceberRequest | None = None,
):
    from datetime import time

    conta = await db.get(ContaAReceber, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")

    data_receb = (data.data_recebimento if data and data.data_recebimento else date.today())
    conta.status = "recebido"
    conta.recebido_em = datetime.combine(data_receb, time.min).replace(tzinfo=timezone.utc)

    # Gera lançamento automático de entrada se informada conta bancária
    if data and data.conta_bancaria_id:
        cb = await db.get(ContaBancaria, data.conta_bancaria_id)
        if not cb or cb.usuario_id != usuario_id:
            raise HTTPException(status_code=404, detail="Conta bancária não encontrada.")
        db.add(LancamentoConta(
            conta_bancaria_id=data.conta_bancaria_id,
            descricao=conta.descricao,
            valor=conta.valor,
            tipo="entrada",
            data=data_receb,
            categoria=conta.origem,
            origem="contas_receber",
        ))

    await db.commit()
    await db.refresh(conta)
    return conta


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_conta_receber(
    conta_id: UUID, usuario_id: CurrentUserID, db: DBSession
):
    conta = await db.get(ContaAReceber, conta_id)
    if not conta or conta.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    await db.delete(conta)
    await db.commit()
