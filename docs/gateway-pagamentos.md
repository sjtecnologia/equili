# Integração de gateway de pagamento — guia passo a passo

> **Status atual:** checkout em **modo teste** (`PAYMENT_GATEWAY=mock`). O fluxo
> completo (PIX com QR code, cartão com URL de pagamento, webhook de confirmação,
> ativação automática do plano) já funciona de ponta a ponta com pagamentos
> simulados. Este guia explica como trocar o `mock` por um provedor real.

---

## 1. Como o checkout funciona hoje

| Peça | Onde | Papel |
| --- | --- | --- |
| `app/services/gateways.py` | backend | Abstração **agnóstica de provedor** (`GatewayPagamento`) + `MockGateway` (dev) |
| `POST /assinaturas/checkout` | backend | Cria `Assinatura` + `Pagamento` e devolve o que o usuário precisa pagar (QR PIX / URL de cartão) |
| `POST /assinaturas/webhook/{gateway}` | backend | Endpoint **público** que valida a assinatura do provedor e confirma o pagamento |
| `POST /assinaturas/me`, `POST /assinaturas/cancelar` | backend | Gestão da assinatura |
| `CheckoutModal` + `PlanosPage` | frontend | Tela de pagamento (PIX copia-e-cola com QR, cartão) + seção "Minha assinatura" |

O **preço nunca vem do cliente**: o backend consulta o catálogo de planos
(`app/core/planos.py`) e usa `Plano.preco_mensal` como valor do checkout.

Em modo teste:
- PIX devolve um "QR visual" determinístico (SVG) + código de copia-e-cola fake;
- cartão devolve uma URL de pagamento fake;
- o frontend mostra o botão **"Simular pagamento aprovado"**, que dispara o
  **mesmo webhook** que um provedor real usaria (`/assinaturas/webhook/mock`),
  com a assinatura `X-Equili-Mock: <PAYMENT_MOCK_KEY>`.

---

## 2. Arquitetura da camada de gateway

```
app/services/gateways.py
├── GatewayPagamento (ABC)
│   ├── criar_checkout(plano_descricao, valor, referencia_usuario, metodo)
│   │      → CheckoutResult(gateway_referencia, qr_code, qr_base64, url_pagamento, expira_em)
│   └── interpretar_webhook(payload, headers)
│          → WebhookEvento(gateway_referencia, confirmado, valor)
├── MockGateway            ← usado agora (PAYMENT_GATEWAY=mock)
└── obter_gateway(nome?)   ← factory; resolve adaptador por settings.PAYMENT_GATEWAY
```

Para adicionar um provedor real você **só cria um novo adaptador** — rotas e
frontend não mudam.

---

## 3. Passo a passo (exemplo: Asaas)

> O mesmo raciocínio vale para Appmax, Mercado Pago, Stripe etc. O papel do
> adaptador é traduzir o contrato do provedor para os dataclasses do Equili.

### 3.1 Criar conta e produtos no provedor

1. Crie a conta no provedor (ex.: [asaas.com](https://www.asaas.com/registro) — modo sandbox existe).
2. No painel do provedor, crie um **plano/produto** para cada assinatura:
   - **Premium** — R$ 19,90/mês (mensal)
   - **Pro / Família** — R$ 34,90/mês (mensal)
3. Anote os IDs retornados (ex.: `plan_premium_mensal`, `plan_pro_mensal`) — eles
   serão usados pelo adaptador para criar as cobranças recorrentes.

### 3.2 Variáveis de ambiente

Adicione ao `backend/.env` (e `.env.example`):

```bash
# Provedor de pagamento: mock (teste) | asaas | appmax | stripe ...
PAYMENT_GATEWAY=asaas

# Credenciais do provedor (nunca commitar!)
PAYMENT_ASAAS_API_KEY=seu_token_do_asaas
PAYMENT_ASAAS_WEBHOOK_SECRET=token_para_assinatura_do_webhook
```

### 3.3 Implementar o adaptador

Crie `app/services/gateways/asaas.py` (ou estenda `gateways.py`) seguindo a
interface. Esqueleto com a ideia central:

```python
class AsaasGateway(GatewayPagamento):
    nome = "asaas"

    async def criar_checkout(self, *, plano_descricao, valor, referencia_usuario, metodo="pix"):
        # 1. Criar a cobrança no Asaas (para PIX: billingType=PIX; para cartão,
        #    o fluxo de cartão recorrente costuma abrir uma URL de checkout).
        # 2. Guardar o id retornado como gateway_referencia (referência do pagamento).
        # 3. Para PIX, salvar qr_code (copia-e-cola) e qr_base64 (imagem base64).
        return CheckoutResult(gateway_referencia=..., qr_code=..., qr_base64=..., url_pagamento=None, expira_em=...)

    def interpretar_webhook(self, payload: dict, headers: dict) -> WebhookEvento:
        # 1. Validar o token de webhook (headers) — IMPORTANTE, é o que evita
        #    que qualquer um confirme pagamentos.
        # 2. Mapear o evento do provedor:
        #      status == "RECEIVED"  -> EVENTO_PAGO
        #      status == "REFUNDED"  -> evento de recusa
        # 3. gateway_referencia = payload["payment"]["id"]
        return WebhookEvento(gateway_referencia=..., confirmado=..., valor=...)
```

### 3.4 Registrar o webhook no provedor

1. No painel do provedor, cadastre o endpoint de webhook:
   `https://api.equili.com.br/api/v1/assinaturas/webhook/asaas`
2. Habilite os eventos de pagamento (pagamento confirmado / recusado / estornado).
3. Configure o **secret** usado para assinar as requisições e preencha
   `PAYMENT_ASAAS_WEBHOOK_SECRET`.

> Em produção o endpoint `.../webhook/mock` é desativado automaticamente pelo
> próprio backend quando `PAYMENT_GATEWAY != mock` (retorna 404).

### 3.5 Ativar e validar

1. Rode `alembic upgrade head` (cria `assinaturas` e `pagamentos`).
2. Aponte `PAYMENT_GATEWAY=asaas` e suba o backend.
3. Teste o fluxo real com valores baixos (sandbox): assinar → pagar → conferir
   que o plano foi ativado em `GET /assinaturas/me` e `GET /planos/me`.
4. Confira no painel do provedor se o webhook chegou com status 200.

---

## 4. Checklist de validação

- [ ] `GET /planos` público continua funcionando
- [ ] `POST /assinaturas/checkout` com PIX devolve `qr_code` + `qr_base64` reais
- [ ] `POST /assinaturas/checkout` com cartão devolve `url_pagamento` real
- [ ] Webhook **sem** secret → **401**
- [ ] Webhook **com** secret e evento `pagamento_confirmado` → 200, plano ativado
- [ ] Pagamento duplicado não repete ativação (`duplicado: true`)
- [ ] `POST /assinaturas/cancelar` volta o usuário ao `gratuito`
- [ ] Upgrade Premium → Pro encerra a assinatura anterior automaticamente