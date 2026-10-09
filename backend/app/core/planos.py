"""
Catálogo central de planos e *entitlements* (regras de acesso por assinatura).

Este módulo é a **única fonte da verdade** sobre o que cada plano libera:
- quais funcionalidades (recursos) estão disponíveis;
- quais são os limites de volume (``None`` = ilimitado).

Rotas e serviços devem consultar este catálogo (``tem_recurso`` / ``limite``)
em vez de comparar ``usuario.plano`` diretamente, para manter a regra num só lugar.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.core.config import settings

# ─── Nomes dos planos ────────────────────────────────────────────────────────

PLANO_GRATUITO = "gratuito"
PLANO_PREMIUM = "premium"
PLANO_PRO = "pro"

PLANOS_VALIDOS = (PLANO_GRATUITO, PLANO_PREMIUM, PLANO_PRO)
PLANO_PADRAO = PLANO_GRATUITO

# ─── Recursos (funcionalidades liberadas por plano) ──────────────────────────

RECURSO_CONTAS_BANCARIAS = "contas_bancarias"
RECURSO_INVESTIMENTOS = "investimentos"
RECURSO_VOZ = "voz"
RECURSO_EXPORTACAO = "exportacao"
RECURSO_RELATORIOS_AVANCADOS = "relatorios_avancados"
RECURSO_NFS = "nfs"
RECURSO_MULTIUSUARIO = "multiusuario"
RECURSO_IA_PRIORIDADE = "ia_prioridade"
RECURSO_ALERTAS_RESUMO_SEMANAL = "alertas_resumo_semanal"

# ─── Limites (chaves de volume; valor ``None`` = ilimitado) ──────────────────

LIMITE_DIVIDAS_ATIVAS = "dividas_ativas"
LIMITE_CARTOES_CREDITO = "cartoes_credito"
LIMITE_PLANOS_IA_MES = "planos_ia_mes"
LIMITE_CHAT_MSGS_MES = "chat_msgs_mes"
LIMITE_METAS = "metas"
LIMITE_MEMBROS = "membros"


@dataclass(frozen=True)
class Plano:
    """Metadados comerciais de um plano (sem os limites, que são dinâmicos)."""

    nome: str
    rotulo: str
    descricao: str
    preco_mensal: float
    preco_anual: float
    recursos: frozenset[str] = field(default_factory=frozenset)
    destaque: bool = False
    ordem: int = 0


PLANOS: dict[str, Plano] = {
    PLANO_GRATUITO: Plano(
        nome=PLANO_GRATUITO,
        rotulo="Gratuito",
        descricao="Para começar a organizar a vida financeira.",
        preco_mensal=0.0,
        preco_anual=0.0,
        recursos=frozenset(),
        ordem=0,
    ),
    PLANO_PREMIUM: Plano(
        nome=PLANO_PREMIUM,
        rotulo="Premium",
        descricao="Controle completo, sem limites, para você.",
        preco_mensal=19.90,
        preco_anual=199.00,
        recursos=frozenset(
            {
                RECURSO_CONTAS_BANCARIAS,
                RECURSO_INVESTIMENTOS,
                RECURSO_VOZ,
                RECURSO_EXPORTACAO,
                RECURSO_RELATORIOS_AVANCADOS,
                RECURSO_ALERTAS_RESUMO_SEMANAL,
            }
        ),
        destaque=True,
        ordem=1,
    ),
    PLANO_PRO: Plano(
        nome=PLANO_PRO,
        rotulo="Pro / Família",
        descricao="Tudo do Premium, mais família e NFS-e para autônomos.",
        preco_mensal=34.90,
        preco_anual=349.00,
        recursos=frozenset(
            {
                RECURSO_CONTAS_BANCARIAS,
                RECURSO_INVESTIMENTOS,
                RECURSO_VOZ,
                RECURSO_EXPORTACAO,
                RECURSO_RELATORIOS_AVANCADOS,
                RECURSO_ALERTAS_RESUMO_SEMANAL,
                RECURSO_NFS,
                RECURSO_MULTIUSUARIO,
                RECURSO_IA_PRIORIDADE,
            }
        ),
        ordem=2,
    ),
}


def normalizar_plano(plano: Optional[str]) -> str:
    """Retorna um nome de plano válido; qualquer valor desconhecido cai no padrão."""
    if plano in PLANOS:
        return plano  # type: ignore[return-value]
    return PLANO_PADRAO


def get_plano(plano: Optional[str]) -> Plano:
    return PLANOS[normalizar_plano(plano)]


def tem_recurso(plano: Optional[str], recurso: str) -> bool:
    return recurso in get_plano(plano).recursos


def limites_do_plano(plano: Optional[str]) -> dict[str, Optional[int]]:
    """Limites de volume aplicáveis ao plano (``None`` = ilimitado)."""
    nome = normalizar_plano(plano)

    if nome == PLANO_GRATUITO:
        # Os limites do plano gratuito permanecem configuráveis via ambiente.
        return {
            LIMITE_DIVIDAS_ATIVAS: settings.PLANO_GRATIS_MAX_DIVIDAS,
            LIMITE_CARTOES_CREDITO: 1,
            LIMITE_PLANOS_IA_MES: settings.PLANO_GRATIS_MAX_PLANOS_IA_MES,
            LIMITE_CHAT_MSGS_MES: 15,
            LIMITE_METAS: 1,
            LIMITE_MEMBROS: 1,
        }

    if nome == PLANO_PREMIUM:
        return {
            LIMITE_DIVIDAS_ATIVAS: None,
            LIMITE_CARTOES_CREDITO: None,
            LIMITE_PLANOS_IA_MES: None,
            LIMITE_CHAT_MSGS_MES: None,
            LIMITE_METAS: None,
            LIMITE_MEMBROS: 2,
        }

    # Pro / Família
    return {
        LIMITE_DIVIDAS_ATIVAS: None,
        LIMITE_CARTOES_CREDITO: None,
        LIMITE_PLANOS_IA_MES: None,
        LIMITE_CHAT_MSGS_MES: None,
        LIMITE_METAS: None,
        LIMITE_MEMBROS: 6,
    }


def limite(plano: Optional[str], recurso: str) -> Optional[int]:
    """Limite de um recurso para o plano. ``None`` significa ilimitado."""
    return limites_do_plano(plano).get(recurso)


def entitlements(plano: Optional[str]) -> dict:
    """Pacote completo do plano para expor ao frontend."""
    p = get_plano(plano)
    return {
        "nome": p.nome,
        "rotulo": p.rotulo,
        "descricao": p.descricao,
        "preco_mensal": p.preco_mensal,
        "preco_anual": p.preco_anual,
        "limites": limites_do_plano(p.nome),
        "recursos": sorted(p.recursos),
    }


def catalogo() -> list[dict]:
    """Lista de planos com entitlements — usada na página de preços."""
    return [entitlements(p.nome) for p in sorted(PLANOS.values(), key=lambda p: p.ordem)]
