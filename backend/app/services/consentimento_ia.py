"""Consentimento explícito para uso de recursos de IA.

A Apple (Guidelines 5.1.1(i) e 5.1.2(i)) e a LGPD exigem que o usuário seja
informado e autorize, de forma clara, o envio de dados a terceiros. O Equili
usa a OpenRouter para chat, Plano de Ação e assistente de voz, portanto nenhuma
dessas rotas pode chamar o provedor antes de o usuário consentir.

O status é exposto em ``GET /usuarios/me`` e alterado em
``POST /usuarios/me/consentimento-ia``.
"""
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.usuario import Usuario

# Versão do texto de consentimento exibido no app. Incrementar quando o
# escopo/fornecedor mudar, para registrar qual versão o usuário aceitou.
CONSENTIMENTO_IA_VERSAO_ATUAL = "2026-11-01"

STATUS_CONSENTIMENTO_NECESSARIO = status.HTTP_428_PRECONDITION_REQUIRED


def verificar_consentimento(usuario: Usuario | None) -> None:
    """Levanta 428 quando o usuário ainda não autorizou o uso de IA."""
    if usuario is None or usuario.consentimento_ia_em is None:
        raise HTTPException(
            status_code=STATUS_CONSENTIMENTO_NECESSARIO,
            detail=(
                "Antes de usar os recursos de inteligência artificial, autorize o "
                "envio dos dados descritos na Política de Privacidade para a "
                "OpenRouter. Você pode revogar essa autorização em Configurações."
            ),
            headers={"X-Equili-Consentimento-IA": "necessario"},
        )


async def exigir_consentimento_ia(usuario_id, db) -> Usuario:
    """Carrega o usuário e exige o consentimento de IA."""
    usuario = await db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    verificar_consentimento(usuario)
    return usuario


def registrar_consentimento(usuario: Usuario, aceito: bool, versao: str | None = None) -> None:
    """Atualiza o consentimento no usuário (aceitar ou revogar)."""
    if aceito:
        usuario.consentimento_ia_em = datetime.now(timezone.utc)
        usuario.consentimento_ia_versao = versao or CONSENTIMENTO_IA_VERSAO_ATUAL
    else:
        usuario.consentimento_ia_em = None
        usuario.consentimento_ia_versao = None
