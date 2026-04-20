import re
from datetime import date
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func as sql_func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.models.conta_bancaria import ContaBancaria
from app.models.lancamento_conta import LancamentoConta

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────────

class LancamentoContaCreate(BaseModel):
    descricao: str
    valor: float
    tipo: str  # entrada | saida
    data: date
    categoria: str | None = None

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        if v not in ("entrada", "saida"):
            raise ValueError("Tipo deve ser 'entrada' ou 'saida'.")
        return v

    @field_validator("valor")
    @classmethod
    def valor_valido(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Valor deve ser positivo.")
        return v


# ─── Helpers ────────────────────────────────────────────────────────────────

async def _get_conta_or_404(conta_id: UUID, usuario_id: UUID, db: DBSession) -> ContaBancaria:
    result = await db.execute(
        select(ContaBancaria).where(
            ContaBancaria.id == conta_id,
            ContaBancaria.usuario_id == usuario_id,
            ContaBancaria.ativo == True,  # noqa: E712
        )
    )
    conta = result.scalar_one_or_none()
    if not conta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta não encontrada.")
    return conta


async def _saldo_atual(conta_id: UUID, saldo_inicial: float, db: DBSession) -> float:
    result = await db.execute(
        select(
            sql_func.coalesce(
                sql_func.sum(
                    sql_func.case(
                        (LancamentoConta.tipo == "entrada", LancamentoConta.valor),
                        else_=-LancamentoConta.valor,
                    )
                ),
                0.0,
            )
        ).where(LancamentoConta.conta_bancaria_id == conta_id)
    )
    return saldo_inicial + float(result.scalar() or 0)


def _parse_ofx(content: str) -> list[dict]:
    """Parse OFX/QFX SGML or XML transactions."""
    transactions: list[dict] = []
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    parts = re.split(r"<STMTTRN\s*>", content, flags=re.IGNORECASE)
    for part in parts[1:]:
        end_match = re.search(r"</STMTTRN>|<STMTTRN\s*>", part, re.IGNORECASE)
        block = part[: end_match.start()] if end_match else part

        dtposted = re.search(r"<DTPOSTED>([^\s<\n]+)", block, re.IGNORECASE)
        trnamt = re.search(r"<TRNAMT>([^\s<\n]+)", block, re.IGNORECASE)
        memo = re.search(r"<MEMO>([^\n<]+)", block, re.IGNORECASE)
        fitid = re.search(r"<FITID>([^\s<\n]+)", block, re.IGNORECASE)
        name = re.search(r"<NAME>([^\n<]+)", block, re.IGNORECASE)

        if not (dtposted and trnamt):
            continue

        date_str = dtposted.group(1).strip()[:8]
        try:
            d = date(int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8]))
        except (ValueError, IndexError):
            continue

        try:
            amount = float(trnamt.group(1).strip().replace(",", "."))
        except ValueError:
            continue

        desc_match = memo or name
        descricao = desc_match.group(1).strip() if desc_match else "Lançamento OFX"
        tipo = "entrada" if amount >= 0 else "saida"

        transactions.append(
            {
                "data": d,
                "valor": abs(amount),
                "tipo": tipo,
                "descricao": descricao,
                "ofx_id": fitid.group(1).strip() if fitid else None,
            }
        )
    return transactions


# ─── Routes ─────────────────────────────────────────────────────────────────

@router.get("/{conta_id}/lancamentos")
async def listar_lancamentos_conta(conta_id: UUID, usuario_id: CurrentUserID, db: DBSession):
    conta = await _get_conta_or_404(conta_id, usuario_id, db)
    result = await db.execute(
        select(LancamentoConta)
        .where(LancamentoConta.conta_bancaria_id == conta_id)
        .order_by(LancamentoConta.data.desc(), LancamentoConta.criado_em.desc())
    )
    lancamentos = result.scalars().all()
    saldo = await _saldo_atual(conta_id, float(conta.saldo_inicial), db)
    return {
        "lancamentos": [
            {
                "id": str(l.id),
                "descricao": l.descricao,
                "valor": float(l.valor),
                "tipo": l.tipo,
                "data": l.data.isoformat(),
                "categoria": l.categoria,
                "origem": l.origem,
                "ofx_id": l.ofx_id,
            }
            for l in lancamentos
        ],
        "saldo_inicial": float(conta.saldo_inicial),
        "saldo_atual": saldo,
        "nome": conta.nome,
        "banco": conta.banco,
        "cor": conta.cor,
        "tipo": conta.tipo,
    }


@router.post("/{conta_id}/lancamentos", status_code=status.HTTP_201_CREATED)
async def criar_lancamento_conta(
    conta_id: UUID,
    body: LancamentoContaCreate,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    await _get_conta_or_404(conta_id, usuario_id, db)
    lancamento = LancamentoConta(
        conta_bancaria_id=conta_id,
        descricao=body.descricao,
        valor=body.valor,
        tipo=body.tipo,
        data=body.data,
        categoria=body.categoria,
        origem="manual",
    )
    db.add(lancamento)
    await db.commit()
    await db.refresh(lancamento)
    return {
        "id": str(lancamento.id),
        "descricao": lancamento.descricao,
        "valor": float(lancamento.valor),
        "tipo": lancamento.tipo,
        "data": lancamento.data.isoformat(),
        "categoria": lancamento.categoria,
        "origem": lancamento.origem,
    }


@router.delete("/{conta_id}/lancamentos/{lancamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_lancamento_conta(
    conta_id: UUID,
    lancamento_id: UUID,
    usuario_id: CurrentUserID,
    db: DBSession,
):
    await _get_conta_or_404(conta_id, usuario_id, db)
    result = await db.execute(
        select(LancamentoConta).where(
            LancamentoConta.id == lancamento_id,
            LancamentoConta.conta_bancaria_id == conta_id,
        )
    )
    lancamento = result.scalar_one_or_none()
    if not lancamento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lançamento não encontrado.")
    await db.delete(lancamento)
    await db.commit()


@router.post("/{conta_id}/importar-ofx")
async def importar_ofx(
    conta_id: UUID,
    usuario_id: CurrentUserID,
    db: DBSession,
    arquivo: UploadFile = File(...),
):
    await _get_conta_or_404(conta_id, usuario_id, db)
    content = await arquivo.read()
    try:
        text = content.decode("latin-1")
    except Exception:
        text = content.decode("utf-8", errors="replace")

    transacoes = _parse_ofx(text)
    if not transacoes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma transação encontrada no arquivo OFX.",
        )

    novos = 0
    for t in transacoes:
        if t["ofx_id"]:
            exists = await db.execute(
                select(LancamentoConta).where(
                    LancamentoConta.conta_bancaria_id == conta_id,
                    LancamentoConta.ofx_id == t["ofx_id"],
                )
            )
            if exists.scalar_one_or_none():
                continue
        lancamento = LancamentoConta(
            conta_bancaria_id=conta_id,
            descricao=t["descricao"],
            valor=t["valor"],
            tipo=t["tipo"],
            data=t["data"],
            origem="ofx",
            ofx_id=t["ofx_id"],
        )
        db.add(lancamento)
        novos += 1

    await db.commit()
    return {"importados": novos, "total": len(transacoes)}
