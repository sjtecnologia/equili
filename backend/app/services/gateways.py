"""
Camada de gateway de pagamento — agnóstica de provedor.

O app conversa apenas com ``GatewayPagamento``:
- ``criar_checkout`` devolve o que o usuário precisa para pagar (PIX
  copia-e-cola/imagem ou URL de cartão);
- ``interpretar_webhook`` valida a assinatura do provedor e interpreta o
  callback de confirmação.

Em desenvolvimento o provedor configurado é o ``mock`` (checkout simulado +
webhook local disparável pela própria interface). Para entrar em produção,
basta criar um novo adaptador (ex.: Asaas/Appmax/Stripe) seguindo a mesma
interface e apontar ``PAYMENT_GATEWAY`` para ele — a rota e o frontend não
mudam.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.core.config import settings

# ─── Constantes ──────────────────────────────────────────────────────────────

GC_MOCK = "mock"

METODO_PIX = "pix"
METODO_CARTAO = "cartao"

EVENTO_PAGO = "pagamento_confirmado"
EVENTO_RECUSADO = "pagamento_recusado"


@dataclass(frozen=True)
class CheckoutResult:
    """O que o consumidor precisa para concluir o pagamento."""

    gateway_referencia: str
    qr_code: str | None = None       # PIX copia-e-cola
    qr_base64: str | None = None     # imagem do QR em base64 (data URI)
    url_pagamento: str | None = None  # redirecionamento de cartão
    expira_em: datetime | None = None
    metadados: dict = field(default_factory=dict)


@dataclass(frozen=True)
class WebhookEvento:
    """Evento normalizado recebido do provedor."""

    gateway_referencia: str
    confirmado: bool = False
    valor: float | None = None
    metadados: dict = field(default_factory=dict)


class GatewayPagamento(ABC):
    nome: str

    @abstractmethod
    def criar_checkout(
        self,
        *,
        plano_descricao: str,
        valor: float,
        referencia_usuario: str,
        metodo: str = "pix",
    ) -> CheckoutResult: ...

    @abstractmethod
    def interpretar_webhook(self, payload: dict, headers: dict) -> WebhookEvento: ...


# ─── Gateway mock (desenvolvimento) ──────────────────────────────────────────


def _qr_svg_base64(texto: str) -> str:
    """Gera um QR "visual" determinístico em SVG (base64) — apenas para o modo mock.

    Não é um QR real: é um padrão estável derivado do texto, suficiente para
    demonstrar o fluxo de checkout sem adicionar dependências.
    """
    digest = hashlib.sha256(texto.encode()).digest()
    n = 21

    def bit(x: int, y: int) -> bool:
        # Espera-se os três padrões localizadores ("olhos") do QR.
        for ox in (0, n - 7):
            for oy in (0, n - 7):
                fx, fy = x - ox, y - oy
                if 0 <= fx < 7 and 0 <= fy < 7:
                    borda = fx in (0, 6) or fy in (0, 6)
                    centro = 2 <= fx <= 4 and 2 <= fy <= 4
                    return borda or centro
        byte = digest[(x * n + y) % len(digest)]
        return bool((byte >> ((x + y) % 8)) & 1)

    cells = [
        f'<rect x="{x * 10}" y="{y * 10}" width="10" height="10" fill="#0f172a"/>'
        for y in range(n)
        for x in range(n)
        if bit(x, y)
    ]
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{n * 10}" height="{n * 10}" '
        f'viewBox="0 0 {n * 10} {n * 10}">'
        f'<rect width="{n * 10}" height="{n * 10}" fill="#ffffff"/>{"".join(cells)}</svg>'
    )
    b64 = base64.b64encode(svg.encode()).decode()
    return f"data:image/svg+xml;base64,{b64}"


class MockGateway(GatewayPagamento):
    """Checkout e webhook simulados, pensados para desenvolvimento.

    O webhook reconhece o header ``X-Equili-Mock`` (chave de ``PAYMENT_MOCK_KEY``)
    e um payload no formato abaixo — o mesmo caminho que um provedor real usará:

    .. code-block:: json
        {
          "evento": "pagamento_confirmado",
          "pagamento_id": "<gateway_pagamento_id devolvido no checkout>",
          "aprovado": true,
          "valor": 19.9
        }
    """

    nome = GC_MOCK

    def criar_checkout(
        self,
        *,
        plano_descricao: str,
        valor: float,
        referencia_usuario: str,
        metodo: str = "pix",
    ) -> CheckoutResult:
        ref = str(uuid.uuid4())
        expira = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PAYMENT_CHECKOUT_EXPIRA_MINUTOS
        )
        if metodo == METODO_CARTAO:
            return CheckoutResult(
                gateway_referencia=ref,
                qr_code=None,
                qr_base64=None,
                url_pagamento=f"https://pagamento.equili.my/checkout/{ref}",
                expira_em=expira,
            )
        return CheckoutResult(
            gateway_referencia=ref,
            qr_code=(
                "00020126580014BR.GOV.BCB.PIX0136"
                f"equili-{ref[:8]}-{referencia_usuario[:8]}"
                f"52040000530398654{valor:.2f}5802BR5913EQUILI LTDA6009SAO PAULO"
                "62070503***6304"
            ),
            qr_base64=_qr_svg_base64(ref),
            url_pagamento=None,
            expira_em=expira,
        )

    def interpretar_webhook(self, payload: dict, headers: dict) -> WebhookEvento:
        chave_recebida = headers.get("x-equili-mock") or headers.get("X-Equili-Mock")
        if not hmac.compare_digest(chave_recebida or "", settings.PAYMENT_MOCK_KEY):
            raise HTTPException(
                status_code=401, detail="Assinatura do webhook inválida."
            )

        evento = payload.get("evento")
        gateway_referencia = str(payload.get("pagamento_id") or "").strip()
        if not gateway_referencia:
            raise HTTPException(
                status_code=400, detail="Payload sem 'pagamento_id'."
            )

        if evento == EVENTO_PAGO:
            return WebhookEvento(
                gateway_referencia=gateway_referencia,
                confirmado=bool(payload.get("aprovado", True)),
                valor=float(payload["valor"]) if payload.get("valor") is not None else None,
                metadados={"evento": evento},
            )
        if evento == EVENTO_RECUSADO:
            return WebhookEvento(
                gateway_referencia=gateway_referencia,
                confirmado=False,
                metadados={"evento": evento},
            )
        raise HTTPException(
            status_code=400, detail=f"Evento de webhook desconhecido: {evento!r}"
        )


def obter_gateway(nome: str | None = None) -> GatewayPagamento:
    """Retorna o adaptador do gateway configurado (ou um específico pelo nome)."""
    escolhido = (nome or settings.PAYMENT_GATEWAY or GC_MOCK).strip().lower()
    if escolhido == GC_MOCK:
        return MockGateway()
    raise HTTPException(
        status_code=400,
        detail=f"Gateway de pagamento não suportado: {escolhido}",
    )