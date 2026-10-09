import logging
from datetime import date, datetime, timezone
from uuid import UUID
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import extract, func, select

from app.core.dependencies import CurrentUserID, DBSession
from app.core.rastro_client import rastro_client
from app.models.plano_acao import PlanoAcao
from app.services.openrouter import OpenRouterNotConfigured
from app.services.plano_acao.geracao import PlanoIAError, gerar_plano_ia
from app.services.plano_acao.resumo_financeiro import montar_resumo_financeiro

router = APIRouter()
logger = logging.getLogger(__name__)


async def _verificar_cota_ia(usuario_id: UUID, db) -> None:
    from app.core import planos
    from app.models.usuario import Usuario

    usuario = await db.get(Usuario, usuario_id)
    plano = planos.normalizar_plano(usuario.plano if usuario else None)
    limite = planos.limite(plano, planos.LIMITE_PLANOS_IA_MES)
    if limite is None:
        return
    now = datetime.now(timezone.utc)
    count = await db.scalar(
        select(func.count()).where(
            PlanoAcao.usuario_id == usuario_id,
            extract("month", PlanoAcao.criado_em) == now.month,
            extract("year", PlanoAcao.criado_em) == now.year,
        )
    )
    if count >= limite:
        rotulo = planos.get_plano(plano).rotulo
        await rastro_client.send_warning_event(
            message=f"Usuário excedeu cota mensal de geração de plano IA no plano {rotulo}.",
            fingerprint="equili:plano_acao:quota:limit_exceeded",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Você atingiu o limite de {limite} planos por mês no plano {rotulo}.",
            headers={"X-Equili-Recurso": planos.LIMITE_PLANOS_IA_MES},
        )


@router.post("/gerar", status_code=status.HTTP_201_CREATED)
async def gerar_plano(usuario_id: CurrentUserID, db: DBSession):
    await _verificar_cota_ia(usuario_id, db)

    # Pré-processa os dados no servidor: a IA recebe só o resumo compacto, nunca os registros brutos
    resumo = await montar_resumo_financeiro(db, usuario_id)

    if resumo["qtd_rendas"] == 0:
        await rastro_client.send_warning_event(
            message="Tentativa de gerar plano de ação sem renda cadastrada.",
            fingerprint="equili:plano_acao:business:no_income_registered",
        )
        raise HTTPException(status_code=400, detail="Cadastre ao menos uma renda antes de gerar o plano.")

    if resumo["saldo_projetado_30_dias"] < 0:
        await rastro_client.send_warning_event(
            message=(
                f"Fluxo de caixa projetado negativo em 30 dias para geração de plano: "
                f"saldo={resumo['saldo_projetado_30_dias']:.2f}"
            ),
            fingerprint="equili:plano_acao:cashflow:negative_30d",
        )

    try:
        conteudo_json, conteudo_texto, tokens_usados = await gerar_plano_ia(resumo, date.today())
    except OpenRouterNotConfigured:
        await rastro_client.send_warning_event(
            message="Serviço de plano de ação chamado sem OPENROUTER_API_KEY configurado.",
            fingerprint="equili:plano_acao:config:missing_openrouter_key",
        )
        raise HTTPException(status_code=503, detail="Serviço de IA não configurado. Verifique o OPENROUTER_API_KEY.")
    except TimeoutError:
        await rastro_client.send_warning_event(
            message="Timeout ao chamar provedor de IA do plano de ação.",
            fingerprint="equili:plano_acao:provider:timeout",
        )
        raise HTTPException(status_code=503, detail="O serviço de IA demorou muito para responder. Tente novamente.")
    except httpx.HTTPStatusError as e:
        logger.error("Erro na API LLM: status %s", e.response.status_code)
        await rastro_client.send_warning_event(
            message=f"Falha HTTP no provedor de IA do plano de ação: status {e.response.status_code}.",
            fingerprint=f"equili:plano_acao:provider:http_status:{e.response.status_code}",
        )
        raise HTTPException(status_code=503, detail="Serviço de IA indisponível no momento.")
    except (PlanoIAError, ValueError) as e:
        await rastro_client.send_warning_event(
            message="Resposta sem JSON válido do provedor de IA no plano de ação.",
            fingerprint="equili:plano_acao:provider:invalid_json",
        )
        detail = str(e) if isinstance(e, PlanoIAError) else "Resposta inválida do serviço de IA."
        raise HTTPException(status_code=503, detail=detail)

    data_livre = None
    data_livre_str = conteudo_json.get("data_livre_prevista")
    if data_livre_str:
        try:
            data_livre = date.fromisoformat(f"{data_livre_str}-01")
        except ValueError:
            pass

    plano = PlanoAcao(
        usuario_id=usuario_id,
        conteudo=conteudo_json,
        conteudo_texto=conteudo_texto,
        estrategia=conteudo_json.get("estrategia"),
        data_livre_prevista=data_livre,
        tokens_usados=tokens_usados,
    )
    db.add(plano)
    await db.commit()
    await db.refresh(plano)
    return plano


@router.get("/atual")
async def plano_atual(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(PlanoAcao)
        .where(PlanoAcao.usuario_id == usuario_id)
        .order_by(PlanoAcao.criado_em.desc())
        .limit(1)
    )
    plano = result.scalar_one_or_none()
    if not plano:
        raise HTTPException(status_code=404, detail="Nenhum plano gerado ainda.")
    return plano


@router.get("/historico")
async def historico_planos(usuario_id: CurrentUserID, db: DBSession):
    result = await db.execute(
        select(PlanoAcao)
        .where(PlanoAcao.usuario_id == usuario_id)
        .order_by(PlanoAcao.criado_em.desc())
        .limit(3)
    )
    return result.scalars().all()


class FeedbackRequest(BaseModel):
    feedback: Literal[1, -1]
    feedback_texto: str | None = Field(default=None, max_length=500)


@router.post("/{plano_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def enviar_feedback(plano_id: UUID, data: FeedbackRequest, usuario_id: CurrentUserID, db: DBSession):
    plano = await db.get(PlanoAcao, plano_id)
    if not plano or plano.usuario_id != usuario_id:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")

    # Validation is now handled by the FeedbackRequest model

    plano.feedback = data.feedback
    plano.feedback_texto = data.feedback_texto
    await db.commit()
