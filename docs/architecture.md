# Arquitetura Técnica — Equili

**Versão:** 1.0
**Data:** 24 de março de 2026
**Architect:** Winston (BMad Architect Agent)
**Status:** Aprovado para Desenvolvimento

---

## 1. Visão Geral da Arquitetura

O Equili é uma aplicação web fullstack com arquitetura **cliente-servidor desacoplada**, composta por:

- **Frontend SPA** (React + Vite) servido via CDN
- **Backend API REST** (FastAPI / Python) stateless
- **Banco de dados relacional** (PostgreSQL)
- **Integração LLM** (OpenRouter) para geração do Plano de Ação
- **Serviços de suporte**: Email transacional, Gateway de pagamento

```
┌─────────────────────────────────────────────────────────┐
│                    USUÁRIO (Browser)                     │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────┐
│              CDN / Hosting (Vercel / Netlify)            │
│              React + Vite + Tailwind (SPA)               │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API (HTTPS/JSON)
┌───────────────────────▼─────────────────────────────────┐
│              API Gateway / Load Balancer                  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Backend — FastAPI (Python)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Auth    │ │  Renda   │ │  Contas  │ │  Dívidas   │ │
│  │ Service  │ │ Service  │ │ Service  │ │  Service   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │   AI Plan Service    │  │   Notification Service   │ │
│  │  (OpenRouter LLM)     │  │   (Email / Alertas)      │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────────────┐
│    PostgreSQL        │   │   Serviços Externos          │
│    (Banco Principal) │   │   · OpenRouter (LLM)         │
│                      │   │   · Resend (Email)           │
│                      │   │   · Stripe/Pagar.me (Pgto)  │
└─────────────────────┘   └─────────────────────────────┘
```

---

## 2. Stack Tecnológico Completo

### 2.1 Frontend

| Tecnologia | Versão | Justificativa |
|-----------|--------|---------------|
| React | 18.x | Ecossistema maduro, componentização robusta |
| Vite | 5.x | Build ultrarrápido, HMR excelente para DX |
| TypeScript | 5.x | Tipagem estática — essencial para dados financeiros |
| Tailwind CSS | 3.x | Utility-first, consistência com o design system |
| React Router | 6.x | Roteamento SPA declarativo |
| TanStack Query | 5.x | Cache de servidor, loading/error states automáticos |
| React Hook Form | 7.x | Formulários com validação performática |
| Zod | 3.x | Validação de schema compartilhada com backend |
| Recharts | 2.x | Gráficos financeiros (rosca, linha de progresso) |
| Lucide React | latest | Ícones (conforme UX spec) |
| Axios | 1.x | HTTP client com interceptors para auth |
| canvas-confetti | latest | Celebração ao quitar dívida |

### 2.2 Backend

| Tecnologia | Versão | Justificativa |
|-----------|--------|---------------|
| Python | 3.12+ | Excelente ecossistema IA/data |
| FastAPI | 0.110+ | Async nativo, OpenAPI automático, alta performance |
| SQLAlchemy | 2.x | ORM maduro com suporte async |
| Alembic | latest | Migrations de banco versionadas |
| Pydantic | 2.x | Validação de dados + schemas da API |
| python-jose | latest | JWT tokens (access + refresh) |
| passlib[bcrypt] | latest | Hash de senhas seguro |
| httpx | latest | HTTP client async para chamadas à API LLM |
| celery | 5.x | Tarefas assíncronas (envio de emails, alertas) |
| APScheduler | 3.x | Agendamento de alertas de vencimento |
| python-dotenv | latest | Gerenciamento de variáveis de ambiente |

### 2.3 Banco de Dados

| Tecnologia | Versão | Justificativa |
|-----------|--------|---------------|
| PostgreSQL | 16.x | ACID, integridade referencial, JSONB para dados IA |
| asyncpg | latest | Driver async de alta performance para PostgreSQL |

### 2.4 Infraestrutura e DevOps

| Serviço | Uso |
|---------|-----|
| Docker + Docker Compose | Desenvolvimento local e containerização |
| GitHub Actions | CI/CD pipeline |
| Vercel / Netlify | Hosting do frontend (CDN global) |
| Railway / Render | Hosting do backend + PostgreSQL (MVP) |
| OpenRouter | API LLM (modelos gratuitos `:free`) |
| Resend | Email transacional |
| Stripe / Pagar.me | Gateway de pagamento |

---

## 3. Estrutura de Diretórios

### 3.1 Repositório Monorepo

```
equili/
├── frontend/                    # React + Vite
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── ui/              # Design system (Button, Card, Input...)
│   │   │   ├── layout/          # Sidebar, Header, BottomNav
│   │   │   ├── dashboard/       # Componentes do dashboard
│   │   │   ├── dividas/         # Componentes de dívidas
│   │   │   ├── plano/           # Componentes do plano IA
│   │   │   └── shared/          # Componentes reutilizáveis
│   │   ├── hooks/               # Custom hooks
│   │   ├── pages/               # Telas (routing)
│   │   │   ├── auth/
│   │   │   ├── onboarding/
│   │   │   ├── dashboard/
│   │   │   ├── renda/
│   │   │   ├── contas/
│   │   │   ├── dividas/
│   │   │   ├── plano-de-acao/
│   │   │   └── alertas/
│   │   ├── services/            # Chamadas de API (axios)
│   │   ├── stores/              # Estado global (Zustand ou Context)
│   │   ├── types/               # TypeScript interfaces
│   │   ├── utils/               # Helpers (formatCurrency, formatDate)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                     # FastAPI
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── routes/
│   │   │       │   ├── auth.py
│   │   │       │   ├── usuarios.py
│   │   │       │   ├── renda.py
│   │   │       │   ├── contas.py
│   │   │       │   ├── dividas.py
│   │   │       │   ├── plano_acao.py
│   │   │       │   └── alertas.py
│   │   │       └── router.py
│   │   ├── core/
│   │   │   ├── config.py        # Settings (pydantic-settings)
│   │   │   ├── security.py      # JWT, bcrypt
│   │   │   └── dependencies.py  # FastAPI dependencies (get_db, get_user)
│   │   ├── db/
│   │   │   ├── base.py          # Base SQLAlchemy
│   │   │   ├── session.py       # AsyncSession factory
│   │   │   └── migrations/      # Alembic
│   │   ├── models/              # SQLAlchemy ORM models
│   │   │   ├── usuario.py
│   │   │   ├── renda.py
│   │   │   ├── conta.py
│   │   │   ├── divida.py
│   │   │   ├── plano_acao.py
│   │   │   └── alerta.py
│   │   ├── schemas/             # Pydantic schemas (request/response)
│   │   ├── services/            # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── plano_ia_service.py   # Integração OpenRouter
│   │   │   ├── email_service.py
│   │   │   └── pagamento_service.py
│   │   ├── tasks/               # Celery tasks
│   │   │   └── alertas_task.py
│   │   └── main.py              # FastAPI app entry point
│   ├── tests/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── docs/                        # Documentação do projeto
│   ├── project-brief.md
│   ├── prd.md
│   ├── ux-spec.md
│   └── architecture.md          # Este arquivo
│
├── docker-compose.yml           # Dev environment
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Modelo de Dados (PostgreSQL)

### 4.1 Diagrama de Entidades

```
usuarios
  ├── rendas
  ├── contas_fixas
  ├── contas_variaveis
  ├── dividas
  │     └── parcelas
  ├── planos_acao
  ├── uso_ia          -- contadores mensais de IA (cotas do plano)
  └── alertas
```

### 4.2 Schema SQL

```sql
-- Usuários
CREATE TABLE usuarios (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        VARCHAR(150) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    senha_hash  VARCHAR(255) NOT NULL,
    plano       VARCHAR(20) NOT NULL DEFAULT 'gratuito', -- 'gratuito' | 'premium' | 'pro'
    email_verificado BOOLEAN DEFAULT FALSE,
    ativo       BOOLEAN DEFAULT TRUE,
    criado_em   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rendas
CREATE TABLE rendas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    descricao   VARCHAR(150) NOT NULL,
    valor       NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    frequencia  VARCHAR(20) NOT NULL, -- 'mensal' | 'quinzenal' | 'semanal'
    tipo        VARCHAR(30) NOT NULL, -- 'salario' | 'freela' | 'aluguel' | 'outro'
    ativo       BOOLEAN DEFAULT TRUE,
    criado_em   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contas Fixas
CREATE TABLE contas_fixas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    descricao       VARCHAR(150) NOT NULL,
    categoria       VARCHAR(50) NOT NULL, -- 'moradia' | 'transporte' | 'saude' | 'educacao' | 'outro'
    valor           NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    dia_vencimento  SMALLINT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    ativo           BOOLEAN DEFAULT TRUE,
    criado_em       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contas Variáveis
CREATE TABLE contas_variaveis (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    descricao   VARCHAR(150) NOT NULL,
    categoria   VARCHAR(50) NOT NULL, -- 'alimentacao' | 'lazer' | 'vestuario' | 'outro'
    valor_estimado NUMERIC(12, 2) NOT NULL CHECK (valor_estimado >= 0),
    mes         DATE NOT NULL, -- primeiro dia do mês de referência
    criado_em   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dívidas
CREATE TABLE dividas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    descricao           VARCHAR(150) NOT NULL,
    credor              VARCHAR(150),
    tipo                VARCHAR(50) NOT NULL, -- 'cartao_parcelado' | 'emprestimo' | 'financiamento' | 'cheque_pre' | 'outro'
    valor_total         NUMERIC(12, 2) NOT NULL CHECK (valor_total > 0),
    valor_parcela       NUMERIC(12, 2) NOT NULL CHECK (valor_parcela > 0),
    parcelas_restantes  SMALLINT NOT NULL CHECK (parcelas_restantes >= 0),
    taxa_juros_mensal   NUMERIC(6, 4), -- percentual mensal (nullable)
    data_prox_vencimento DATE NOT NULL,
    quitada             BOOLEAN DEFAULT FALSE,
    criado_em           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Planos de Ação (histórico de respostas da IA)
CREATE TABLE planos_acao (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    conteudo        JSONB NOT NULL,  -- resposta estruturada da IA
    conteudo_texto  TEXT NOT NULL,   -- texto completo gerado
    estrategia      VARCHAR(20),     -- 'avalanche' | 'bola_de_neve'
    data_livre_prevista DATE,        -- projeção da IA de quitação total
    feedback        SMALLINT,        -- 1 (positivo) | -1 (negativo) | NULL
    feedback_texto  TEXT,
    tokens_usados   INTEGER,
    criado_em       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alertas
CREATE TABLE alertas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo        VARCHAR(30) NOT NULL, -- 'conta_fixa' | 'divida' | 'meta'
    referencia_id UUID,               -- ID da conta ou dívida relacionada
    titulo      VARCHAR(200) NOT NULL,
    descricao   TEXT,
    data_alerta DATE NOT NULL,
    visto       BOOLEAN DEFAULT FALSE,
    criado_em   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX idx_rendas_usuario ON rendas(usuario_id);
CREATE INDEX idx_contas_fixas_usuario ON contas_fixas(usuario_id);
CREATE INDEX idx_contas_variaveis_usuario_mes ON contas_variaveis(usuario_id, mes);
CREATE INDEX idx_dividas_usuario ON dividas(usuario_id);
CREATE INDEX idx_dividas_quitada ON dividas(usuario_id, quitada);
CREATE INDEX idx_planos_usuario ON planos_acao(usuario_id, criado_em DESC);
CREATE INDEX idx_alertas_usuario_data ON alertas(usuario_id, data_alerta);
CREATE INDEX idx_alertas_nao_vistos ON alertas(usuario_id, visto) WHERE visto = FALSE;
```

---

## 5. API REST — Endpoints

### Convenções
- Base URL: `/api/v1`
- Autenticação: `Authorization: Bearer <access_token>`
- Formato: JSON
- Paginação: `?page=1&limit=20`
- Erros: `{ "detail": "mensagem" }` (padrão FastAPI)

### 5.1 Autenticação

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/auth/register` | Cadastro de usuário | ❌ |
| POST | `/auth/login` | Login (retorna JWT) | ❌ |
| POST | `/auth/refresh` | Renovar access token | ❌ (refresh token) |
| POST | `/auth/logout` | Invalidar refresh token | ✅ |
| POST | `/auth/verify-email` | Verificar email com token | ❌ |
| POST | `/auth/forgot-password` | Solicitar redefinição | ❌ |
| POST | `/auth/reset-password` | Redefinir senha | ❌ |

### 5.2 Usuário

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/usuarios/me` | Perfil do usuário autenticado |
| PATCH | `/usuarios/me` | Atualizar perfil |
| DELETE | `/usuarios/me` | Excluir conta (LGPD) |

### 5.3 Renda

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/rendas` | Listar fontes de renda |
| POST | `/rendas` | Criar fonte de renda |
| PATCH | `/rendas/{id}` | Atualizar renda |
| DELETE | `/rendas/{id}` | Remover renda |

### 5.4 Contas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/contas/fixas` | Listar contas fixas |
| POST | `/contas/fixas` | Criar conta fixa |
| PATCH | `/contas/fixas/{id}` | Atualizar conta fixa |
| DELETE | `/contas/fixas/{id}` | Remover conta fixa |
| GET | `/contas/variaveis` | Listar contas variáveis (mês atual) |
| POST | `/contas/variaveis` | Criar conta variável |
| PATCH | `/contas/variaveis/{id}` | Atualizar |
| DELETE | `/contas/variaveis/{id}` | Remover |

### 5.5 Dívidas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/dividas` | Listar dívidas ativas |
| POST | `/dividas` | Criar dívida (verifica limite plano grátis) |
| PATCH | `/dividas/{id}` | Atualizar dívida |
| DELETE | `/dividas/{id}` | Remover dívida |
| POST | `/dividas/{id}/pagar-parcela` | Registrar parcela paga |
| GET | `/dividas/resumo` | Total geral de dívidas |

### 5.6 Plano de Ação IA

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/plano-acao/gerar` | Gerar novo plano (verifica cota) |
| GET | `/plano-acao/atual` | Plano mais recente |
| GET | `/plano-acao/historico` | Histórico de planos |
| POST | `/plano-acao/{id}/feedback` | Enviar feedback |

### 5.7 Dashboard

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/dashboard/resumo` | Todos os KPIs em uma chamada |

### 5.8 Alertas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/alertas` | Listar alertas (próximos 30 dias) |
| PATCH | `/alertas/{id}/visto` | Marcar como visto |
| DELETE | `/alertas/{id}` | Remover alerta |

### 5.9 Planos e Assinaturas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/planos` | Catálogo público de planos (página de preços) |
| GET | `/planos/me` | Plano atual + entitlements (recursos, limites) + uso do mês |

Regra única no código: `app/core/planos.py` centraliza o catálogo
(`PLANOS_VALIDOS`, preços, recursos por plano e limites de volume).

---

## 6. Segurança

### 6.1 Autenticação JWT

```python
# Access token: 30 minutos
# Refresh token: 30 dias (rotativo)
# Armazenamento: access no memória JS, refresh em httpOnly cookie

ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30
ALGORITHM = "HS256"
```

### 6.2 Proteções Implementadas (OWASP Top 10)

| Ameaça | Mitigação |
|--------|-----------|
| **Injection (SQL)** | SQLAlchemy ORM com queries parametrizadas; nunca SQL raw com f-strings |
| **Broken Auth** | JWT com expiração curta + refresh rotativo; bcrypt para senhas |
| **Sensitive Data** | TLS 1.3 obrigatório; dados financeiros nunca em logs |
| **XXE** | FastAPI não processa XML; JSON apenas |
| **Broken Access Control** | Middleware verifica `usuario_id` em todos os recursos |
| **Security Misconfiguration** | CORS restrito para domínio do frontend; headers de segurança |
| **XSS** | React escapa HTML por padrão; CSP headers no backend |
| **CSRF** | SameSite=Strict no refresh token cookie |
| **Vulnerable Components** | Dependabot ativado; `pip audit` no CI |
| **Insufficient Logging** | Logs estruturados (sem dados sensíveis); alertas de erro no CI |

### 6.3 Rate Limiting

```python
# Endpoints de autenticação: 5 req/min por IP
# Endpoint de geração IA: limitado por cota do usuário (plano)
# API geral: 100 req/min por usuário autenticado
```

### 6.4 Validação de Regra de Negócio (Backend)

Os *entitlements* ficam centralizados em `app/core/planos.py`; as rotas consultam
`tem_recurso()` (funcionalidade) e `limite()` (volume) em vez de comparar
`usuario.plano` manualmente.

```python
# Cotas/limites respondem 429 (Too Many Requests)
# Funcionalidades pagas respondem 402 (Payment Required)
# NUNCA 403/401 — o app móvel interpreta esses códigos como falha de login
# e deslogaria o usuário.

# Feature gated (ex.: investimentos = Premium)
from app.core.dependencies import requer_recurso
from app.core import planos as planos_core

router = APIRouter(dependencies=[Depends(requer_recurso(planos_core.RECURSO_INVESTIMENTOS))])

# Cota de volume (ex.: dívidas ativas do plano grátis)
from app.core import planos as planos_core
limite = planos_core.limite(plano, planos_core.LIMITE_DIVIDAS_ATIVAS)
if limite is not None and count >= limite:
    raise HTTPException(status_code=429, detail="Limite atingido.")
```

### 6.5 Cobrança (roadmap)

O pagamento online (Stripe/PIX) **ainda não está implementado** (fase 2):
- a troca de plano é feita pelo administrador (`PATCH /usuarios/admin/usuarios/{id}/plano`);
- a página `/planos` oferece o catálogo e direciona o contato por e-mail;
- o próximo passo é criar checkout e webhooks de assinatura.

---

## 7. Integração com OpenRouter (LLM)

### 7.1 Configuração

```python
# OpenRouter usa endpoint compatível com OpenAI — modelos gratuitos têm sufixo :free
# O modelo primário precisa suportar response_format (JSON mode) para o Plano de Ação.
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_CHAT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"    # primário (forte, rápido)
OPENROUTER_FALLBACK_MODEL = "google/gemma-4-26b-a4b-it:free"         # fallback (outro vendor)
OPENROUTER_DISABLE_REASONING = True  # evita "thinking" consumir o max_tokens
```

### 7.2 Prompt Engineering — Plano de Ação

```python
SYSTEM_PROMPT = """
Você é um consultor financeiro empático e especialista em finanças pessoais brasileiras.
Seu papel é analisar a situação financeira de uma família e criar um plano de ação
CLARO, MOTIVADOR e REALISTA para quitação de dívidas.

Regras:
- Nunca julgue a situação. Seja encorajador e positivo.
- Use linguagem simples, acessível, sem jargões financeiros excessivos.
- Responda SEMPRE em JSON estruturado conforme o schema abaixo.
- Seja específico com datas e valores.
- Priorize pelo método avalanche (maior juros primeiro) por padrão,
  mas use bola de neve se o valor emocional for mais adequado.

Schema de resposta:
{
  "resumo_situacao": "string (2-3 frases empáticas)",
  "estrategia": "avalanche" | "bola_de_neve",
  "justificativa_estrategia": "string",
  "valor_mensal_para_dividas": number,
  "ordem_quitacao": [
    {
      "ordem": number,
      "descricao": "string",
      "data_quitacao_estimada": "YYYY-MM",
      "motivo_prioridade": "string"
    }
  ],
  "data_livre_prevista": "YYYY-MM",
  "meses_ate_liberdade": number,
  "sugestoes_economia": ["string", "string", "string"],
  "mensagem_motivacional": "string"
}
"""

USER_PROMPT_TEMPLATE = """
Situação financeira da família:

RENDA MENSAL TOTAL: R$ {renda_total}

DESPESAS FIXAS MENSAIS:
{despesas_fixas}

DESPESAS VARIÁVEIS ESTIMADAS:
{despesas_variaveis}

SALDO DISPONÍVEL (após despesas): R$ {saldo_disponivel}

DÍVIDAS ATIVAS:
{dividas}

Data atual: {data_atual}

Crie o plano de ação para esta família.
"""
```

### 7.3 Service de IA

```python
async def gerar_plano_acao(usuario_id: UUID, db: AsyncSession) -> PlanoAcao:
    # 1. Verificar cota (plano grátis: 3/mês)
    await verificar_cota_ia(usuario_id, db)

    # 2. Coletar dados financeiros
    dados = await coletar_dados_financeiros(usuario_id, db)

    # 3. Montar prompt
    user_prompt = USER_PROMPT_TEMPLATE.format(**dados)

    # 4. Chamar OpenRouter (retry + fallback automático em app/services/openrouter.py)
    client = httpx.AsyncClient(timeout=30.0)
    response = await client.post(
        f"{OPENROUTER_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
        json={
            "model": OPENROUTER_CHAT_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.3,  # baixa temperatura = respostas mais consistentes
            "max_tokens": 1500
        }
    )

    # 5. Parsear e validar resposta
    conteudo = response.json()["choices"][0]["message"]["content"]
    plano_json = json.loads(conteudo)
    # Validar com Pydantic schema

    # 6. Salvar no banco e retornar
    return await salvar_plano(usuario_id, plano_json, db)
```

---

## 8. Fluxo de Autenticação Completo

```
Frontend                    Backend                  PostgreSQL
    │                           │                         │
    │── POST /auth/register ──►│                         │
    │                           │── INSERT usuarios ────►│
    │                           │── Envia email verif. ──►(Resend)
    │◄── 201 Created ───────────│                         │
    │                           │                         │
    │── POST /auth/verify ────►│                         │
    │                           │── UPDATE email_verif. ►│
    │◄── 200 OK ────────────────│                         │
    │                           │                         │
    │── POST /auth/login ─────►│                         │
    │                           │── SELECT usuario ──────►│
    │                           │── Verifica bcrypt       │
    │                           │── Gera JWT pair         │
    │◄── {access, refresh} ─────│                         │
    │   (refresh: httpOnly)      │                         │
    │                           │                         │
    │── GET /dashboard/resumo ─►│                         │
    │   Authorization: Bearer   │── Valida JWT            │
    │                           │── SELECT dados ────────►│
    │◄── 200 {dados} ───────────│                         │
```

---

## 9. Ambiente de Desenvolvimento

> **Nota:** O ambiente de desenvolvimento usa `venv` (Python virtual environment) diretamente na máquina, sem Docker.
> Pré-requisitos: Python 3.12+, Node.js 20+, PostgreSQL 16 instalado localmente.

### 9.1 Setup do Backend (venv)

```bash
# 1. Criar e ativar o ambiente virtual
cd backend
python3 -m venv .venv
source .venv/bin/activate          # macOS/Linux
# .venv\Scripts\activate           # Windows

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Configurar variáveis de ambiente
cp ../.env.example .env
# editar .env com seus valores locais

# 4. Criar banco de dados local (PostgreSQL instalado na máquina)
psql -U postgres -c "CREATE DATABASE equili_dev;"
psql -U postgres -c "CREATE USER equili WITH PASSWORD 'equili_dev_pass';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE equili_dev TO equili;"

# 5. Rodar migrations
alembic upgrade head

# 6. Iniciar servidor de desenvolvimento
uvicorn app.main:app --reload --port 8000
```

### 9.2 Setup do Frontend

```bash
cd frontend
npm install
npm run dev
# Acesse: http://localhost:5173
```

### 9.3 Script de setup rápido (run_dev.sh)

```bash
#!/bin/bash
# Inicia backend e frontend em paralelo

echo "Iniciando backend..."
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Iniciando frontend..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo "✅ Equili rodando:"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:5173"
echo "   API Docs: http://localhost:8000/docs"

wait
```

### 9.2 Variáveis de Ambiente (.env.example)

```env
# Backend
DATABASE_URL=postgresql+asyncpg://equili:senha@db:5432/equili_dev
SECRET_KEY=troque-em-producao-use-openssl-rand-hex-32
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# OpenRouter (modelos gratuitos :free)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
OPENROUTER_CHAT_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_FALLBACK_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_DISABLE_REASONING=true

# Email
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@equili.app

# Pagamento
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx

# Frontend
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=Equili
```

---

## 10. CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r backend/requirements.txt
      - run: pip audit  # segurança
      - run: pytest backend/tests/ --cov

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run test
      - run: cd frontend && npm run build

  deploy:
    needs: [backend-tests, frontend-tests]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Frontend (Vercel)
        # vercel deploy --prod
      - name: Deploy Backend (Railway)
        # railway up
```

---

## 11. Decisões de Arquitetura (ADRs)

| # | Decisão | Alternativas Consideradas | Justificativa |
|---|---------|--------------------------|---------------|
| ADR-01 | FastAPI ao invés de Django | Django REST, Flask | Async nativo, OpenAPI automático, melhor performance |
| ADR-02 | PostgreSQL ao invés de MongoDB | MongoDB, SQLite | Dados financeiros exigem ACID e integridade referencial |
| ADR-03 | JWT sem estado ao invés de sessões | Sessions + Redis | Frontend SPA desacoplado; escalabilidade horizontal |
| ADR-04 | Refresh token em httpOnly cookie | localStorage | Proteção contra XSS; localStorage é inseguro para tokens |
| ADR-05 | UUID como PK ao invés de serial | BIGSERIAL | Evita enumeração de IDs por usuários maliciosos |
| ADR-06 | Monorepo ao invés de repos separados | Polyrepo | DX mais simples para projeto de pequeno/médio porte |
| ADR-07 | TanStack Query para state server | Redux, Zustand | Caching, invalidação e loading states automáticos |
| ADR-08 | Resposta IA em JSON estruturado | Texto livre | Facilita renderização estruturada; mais consistente |

---

## 12. Próximos Passos

1. ✅ Project Brief — concluído
2. ✅ PRD — concluído
3. ✅ Especificação UI/UX — concluído
4. ✅ Arquitetura Técnica — **concluído**
5. ⏳ Backlog e Histórias de Usuário — **Sarah (PO)**
6. ⏳ Setup do repositório e ambiente de desenvolvimento
7. ⏳ Início do desenvolvimento — Sprint 1
