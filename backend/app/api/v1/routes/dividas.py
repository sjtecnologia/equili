from datetime import date, datetime, timezone
from calendar import monthrange
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import func, select

from app.core.config import settings
from app.core.dependencies import CurrentUserID, DBSession
from app.models.divida import Divida, DividaPagamento
from app.models.usuario import Usuario

router = APIRouter()

TIPOS_VALIDOS = {"cartao_parcelado", "emprestimo", "financiamento", "cheque_pre", "outro"}


def _avancar_mes(d: date) -> date:
    mes_novo = d.month % 12 + 1
    ano_novo = d.year + (1 if d.month == 12 else 0)
    dia_novo = min(d.day, monthrange(ano_novo, mes_novo)[1])
    return date(ano_novo, mes_novo, dia_novo)


class DividaCreate(BaseModel):
    descricao: str
    credor: str | None = None
    tipo: str
    valor_total: float
    valor_parcela: float
    parcelas_totais: int | None = None
    parcelas_restantes: int
    taxa_juros_mensal: float | None = None
    data_inicio_contrato: date | None = None
    data_primeira_parcela: date | None = None
    data_prox_vencimento: date | None = None

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        if v not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo inválido. Use: {', '.join(TIPOS_VALIDOS)}")
        return v

    @field_validator("valor_total", "valor_parcela")
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("O valor deve ser maior que zero.")
        return v

    @field_validator("parcelas_restantes")
    @classmethod
    def parcelas_validas(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Parcelas restantes não pode ser negativo.")
        return v

    @model_validator(mode="after")
    def computar_prox_vencimento(self) -> "DividaCreate":
        if self.data_prox_vencimento is None:
            if self.data_primeira_parcela is not None:
                self.data_prox_vencimento = self.data_primeira_parcela
            else:
                raise ValueError(
                    "Informe data_primeira_parcela ou data_prox_vencimento."
                )
        return self


class PagarParcelaRequest(BaseModel):
    data_referencia: date | None = None
    data_pagamento: date | None = None
    valor_pago: float | None = None
    observacao: str | None = None


class PagamentoUpdate(BaseModel):
    data_referencia: date | None = None
    data_pagamento: date | None = None
    valor_pago: float | None = None
    observacao: str | None = None


class DividaUpdate(BaseModel):
    descricao: str | None = None
    credor: str | None = None
    tipo: str | None = None
    valor_total: float | None = None
    valor_parcela: float | None = None
    parcelas_totais: int | None = None
    parcelas_restantes: int | None = None
    taxa_juros_mensal: float | None = None
    data_inicio_contrato: date | None = None
    data_primeira_parcela: date | None = None
    data_prox_vencimento: date | None = None

    @field_validator("tipo")
    @classmethod
    def tipo_valido_update(cls, v: str | None) -> str | None:
        if v is not None and v not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo inválido. Use: {', '.join(TIPOS_VALIDOS)}")
        return v

    @field_validator("valor_total", "valor_parcela")
    @classmethod
    def valor_positivo_update(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("O valor deve ser maior que zero.")
        return v


async def _verificar_limite_dividas(usuario_id: UUID, db) -> None:
    usuario = await db.get(Usuario, usuario_id)
    if usuario and usuario.plano == "gratuito":
        count = await db.scalar(
            select(func.count()).where(
                Divida.usuario_id == usuario_id,
                Divida.quitada == False,  # noqa: E712
            )
        )
        if count >= settings.PLANO_GRATIS_MAX_DIVIDAS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Você atingiu o limite de {settings.PLANO_GRATIS_MAX_DIVIDAS} dívidas do plano gratuito. Faça upgrade para adicionar mais.",
            )


@router.get("")
async def listar_dividas(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(Divida)
        .where(Divida.usuario_id == usuario_id, Divida.quitada == False)  # noqa: E712
        .order_by(Divida.data_prox_vencimento)
    )
    dividas = result.scalars().all()

    if not dividas:
        return []

    hoje = date.today()

    # Busca todas as datas pagas de uma vez (evita N+1)
    ids = [d.id for d in dividas]
    pags_result = await db.execute(
        select(DividaPagamento.divida_id, DividaPagamento.data_referencia)
        .where(DividaPagamento.divida_id.in_(ids))
    )
    pagas_por_divida: dict = {}
    for divida_id, data_ref in pags_result:
        pagas_por_divida.setdefault(divida_id, set()).add(data_ref)

    output = []
    for divida in dividas:
        pagas = pagas_por_divida.get(divida.id, set())

        # Conta meses esperados (agenda a partir da 1ª parcela) que ainda não foram pagos
        parcelas_atrasadas = 0
        data_primeira_atrasada = None
        if divida.data_primeira_parcela:
            cur = divida.data_primeira_parcela
            while cur < hoje:
                if cur not in pagas:
                    if data_primeira_atrasada is None:
                        data_primeira_atrasada = cur
                    parcelas_atrasadas += 1
                cur = _avancar_mes(cur)
        elif divida.data_prox_vencimento < hoje:
            # Fallback sem data_primeira_parcela
            data_primeira_atrasada = divida.data_prox_vencimento
            cur = divida.data_prox_vencimento
            while cur < hoje and parcelas_atrasadas < divida.parcelas_restantes:
                parcelas_atrasadas += 1
                cur = _avancar_mes(cur)

        output.append({
            "id": str(divida.id),
            "usuario_id": str(divida.usuario_id),
            "descricao": divida.descricao,
            "credor": divida.credor,
            "tipo": divida.tipo,
            "valor_total": float(divida.valor_total),
            "valor_parcela": float(divida.valor_parcela),
            "parcelas_totais": divida.parcelas_totais,
            "parcelas_restantes": divida.parcelas_restantes,
            "taxa_juros_mensal": float(divida.taxa_juros_mensal) if divida.taxa_juros_mensal else None,
            "data_inicio_contrato": divida.data_inicio_contrato.isoformat() if divida.data_inicio_contrato else None,
            "data_primeira_parcela": divida.data_primeira_parcela.isoformat() if divida.data_primeira_parcela else None,
            "data_prox_vencimento": divida.data_prox_vencimento.isoformat(),
            "data_primeira_atrasada": data_primeira_atrasada.isoformat() if data_primeira_atrasada else None,
            "quitada": divida.quitada,
            "parcelas_atrasadas": parcelas_atrasadas,
        })

    return output


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_divida(data: DividaCreate, usuario_id: CurrentUserID, db: DBSession):
    await _verificar_limite_dividas(usuario_id, db)

    divida = Divida(usuario_id=usuario_id, **data.model_dump())
    db.add(divida)
    await db.commit()
    await db.refresh(divida)
    return divida


@router.patch("/{divida_id}")
async def atualizar_divida(divida_id: UUID, data: DividaUpdate, usuario_id: CurrentUserID, db: DBSession):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")

    update = data.model_dump(exclude_none=True)

    # Se mudou data_primeira_parcela e não informou explicitamente data_prox_vencimento, sincroniza
    if "data_primeira_parcela" in update and "data_prox_vencimento" not in update:
        update["data_prox_vencimento"] = update["data_primeira_parcela"]

    for campo, valor in update.items():
        setattr(divida, campo, valor)

    await db.commit()
    await db.refresh(divida)
    return divida


@router.delete("/{divida_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_divida(divida_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")
    await db.delete(divida)
    await db.commit()


@router.post("/{divida_id}/pagar-parcela")
async def pagar_parcela(divida_id: UUID, data: PagarParcelaRequest, usuario_id: CurrentUserID, db: DBSession):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")

    hoje = datetime.now(timezone.utc).date()

    # Determina qual parcela foi paga
    base = data.data_referencia or divida.data_prox_vencimento

    # Registra o pagamento no histórico
    pagamento = DividaPagamento(
        divida_id=divida.id,
        usuario_id=usuario_id,
        data_referencia=base,
        data_pagamento=data.data_pagamento or hoje,
        valor_pago=data.valor_pago if data.valor_pago is not None else float(divida.valor_parcela),
        valor_parcela_original=float(divida.valor_parcela),
        observacao=data.observacao,
    )
    db.add(pagamento)

    if divida.parcelas_restantes > 0:
        divida.parcelas_restantes -= 1

    if divida.parcelas_restantes == 0:
        divida.quitada = True
    elif divida.data_primeira_parcela:
        # Recalcula data_prox_vencimento usando histórico para detectar gaps
        await db.flush()  # torna o novo pagamento visível na mesma transação
        pags_res = await db.execute(
            select(DividaPagamento.data_referencia)
            .where(DividaPagamento.divida_id == divida.id)
        )
        pagas = set(pags_res.scalars().all())

        # Percorre agenda a partir da 1ª parcela e acha o mês mais antigo não pago
        prox_venc = None
        cur = divida.data_primeira_parcela
        for _ in range(600):  # cap de 50 anos
            if cur not in pagas:
                prox_venc = cur
                break
            cur = _avancar_mes(cur)

        divida.data_prox_vencimento = prox_venc or _avancar_mes(base)
    else:
        divida.data_prox_vencimento = _avancar_mes(base)

    await db.commit()
    await db.refresh(divida)
    return {"quitada": divida.quitada, "parcelas_restantes": divida.parcelas_restantes}


@router.get("/pagamentos")
async def listar_todos_pagamentos(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(DividaPagamento, Divida.descricao, Divida.credor)
        .join(Divida, DividaPagamento.divida_id == Divida.id)
        .where(DividaPagamento.usuario_id == usuario_id)
        .order_by(DividaPagamento.data_referencia.desc())
    )
    rows = result.all()
    return [
        {
            "id": str(p.id),
            "divida_id": str(p.divida_id),
            "divida_descricao": descricao,
            "divida_credor": credor,
            "data_referencia": p.data_referencia.isoformat(),
            "data_pagamento": p.data_pagamento.isoformat() if p.data_pagamento else None,
            "valor_pago": float(p.valor_pago),
            "valor_parcela_original": float(p.valor_parcela_original),
            "observacao": p.observacao,
        }
        for p, descricao, credor in rows
    ]


@router.get("/{divida_id}/pagamentos")
async def listar_pagamentos(divida_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")

    result = await db.execute(
        select(DividaPagamento)
        .where(DividaPagamento.divida_id == divida_id)
        .order_by(DividaPagamento.data_referencia.desc())
    )
    return result.scalars().all()


@router.patch("/{divida_id}/pagamentos/{pagamento_id}")
async def atualizar_pagamento(
    divida_id: UUID,
    pagamento_id: UUID,
    data: PagamentoUpdate,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")

    pagamento = await db.get(DividaPagamento, pagamento_id)
    if not pagamento or pagamento.divida_id != divida_id:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")

    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(pagamento, campo, valor)

    await db.commit()
    await db.refresh(pagamento)
    return pagamento


@router.delete("/{divida_id}/pagamentos/{pagamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_pagamento(
    divida_id: UUID,
    pagamento_id: UUID,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    divida = await db.get(Divida, divida_id)
    if not divida or divida.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Dívida não encontrada.")

    pagamento = await db.get(DividaPagamento, pagamento_id)
    if not pagamento or pagamento.divida_id != divida_id:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")

    await db.delete(pagamento)
    await db.commit()
