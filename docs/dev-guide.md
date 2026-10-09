# Guia de Desenvolvimento — Equili

**Versão:** 0.4.0  
**Atualizado em:** 30 de março de 2026

---

## 1. Pré-requisitos

| Ferramenta | Versão mínima |
|------------|---------------|
| Python | 3.12+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Git | 2.x |

---

## 2. Configuração do ambiente

### 2.1 Clonar o repositório

```bash
git clone https://github.com/sjtecnologia/equili.git
cd equili
```

### 2.2 Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

Criar arquivo `.env` na pasta `backend/`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:SENHA@localhost:5432/equili
SECRET_KEY=sua-chave-secreta-aqui
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
OPENROUTER_API_KEY=sk-or-v1-sua_chave_aqui
OPENROUTER_CHAT_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_FALLBACK_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_DISABLE_REASONING=true
```

### 2.3 Banco de dados

```bash
# Criar o banco
psql -U postgres -c "CREATE DATABASE equili;"

# Aplicar migrations
cd backend
alembic upgrade head
```

**Para restaurar a partir do dump:**

```bash
psql -U postgres -d equili -f database_dump.sql
```

### 2.4 Frontend

```bash
cd frontend
npm install
```

---

## 3. Rodando o projeto

### Backend (porta 8000)

```bash
cd backend
.venv\Scripts\activate     # Windows
python run_server.py
```

Ou diretamente:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Documentação interativa: http://localhost:8000/docs

### Frontend (porta 5173)

```bash
cd frontend
npm run dev
```

Acesse: http://localhost:5173

---

## 4. Estrutura completa do projeto

```
equili/
├── database_dump.sql          # Dump do banco com dados
├── run_dev.sh                 # Script para iniciar os dois serviços
│
├── backend/
│   ├── run_server.py          # Entry point com CORS configurado
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   │       ├── 50cce3ecfaee_initial_schema.py
│   │       ├── a2f3c4e5b6d7_add_contas_lancamentos.py
│   │       └── b3c4d5e6f7a8_add_tipo_to_contas_receber.py
│   └── app/
│       ├── main.py            # FastAPI app, middlewares, CORS
│       ├── api/v1/
│       │   ├── router.py      # Agrupamento de todas as rotas
│       │   └── routes/
│       │       ├── auth.py          # Registro, login, refresh, logout
│       │       ├── usuarios.py      # Perfil do usuário
│       │       ├── rendas.py        # CRUD fontes de renda
│       │       ├── dividas.py       # CRUD dívidas + quitar
│       │       ├── contas_pagar.py  # CRUD + geração em lote (recorrente/parcelada)
│       │       ├── contas_receber.py# CRUD + geração em lote (recorrente/parcelada)
│       │       ├── dashboard.py     # Resumo financeiro
│       │       ├── relatorio.py     # Fluxo de caixa + relatório detalhado
│       │       └── plano_acao.py    # Integração IA (GitHub Models)
│       ├── core/
│       │   ├── config.py      # Configurações via Pydantic Settings
│       │   ├── dependencies.py# Deps FastAPI: DBSession, CurrentUserID
│       │   └── security.py    # JWT, bcrypt, token helpers
│       ├── db/
│       │   ├── base.py        # DeclarativeBase SQLAlchemy
│       │   └── session.py     # AsyncSession factory
│       ├── models/
│       │   ├── usuario.py
│       │   ├── renda.py
│       │   ├── divida.py
│       │   ├── conta_lancamento.py  # ContaAPagar + ContaAReceber
│       │   └── plano_acao.py
│       └── schemas/
│           └── auth.py
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── App.tsx            # Rotas React Router
        ├── main.tsx
        ├── index.css
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.tsx  # Container com Sidebar + BottomNav
        │   │   ├── BottomNav.tsx  # Navegação mobile (5 itens)
        │   │   └── Sidebar.tsx    # Navegação desktop
        │   └── ui/
        │       └── CurrencyInput.tsx  # Input monetário pt-BR reutilizável
        ├── pages/
        │   ├── auth/
        │   │   ├── LoginPage.tsx
        │   │   └── CadastroPage.tsx
        │   ├── onboarding/
        │   │   └── OnboardingPage.tsx
        │   ├── dashboard/
        │   │   └── DashboardPage.tsx
        │   ├── renda/
        │   │   └── RendaPage.tsx
        │   ├── dividas/
        │   │   └── DividasPage.tsx
        │   ├── contas-pagar/
        │   │   └── ContasPagarPage.tsx
        │   ├── contas-receber/
        │   │   └── ContasReceberPage.tsx
        │   ├── relatorios/
        │   │   └── RelatoriosPage.tsx
        │   └── plano-de-acao/
        │       └── PlanoAcaoPage.tsx
        ├── services/
        │   └── api.ts         # Axios com interceptor de auth e refresh automático
        ├── stores/
        │   └── authStore.ts   # Zustand: accessToken, setAccessToken, logout
        └── utils/
            └── format.ts      # formatCurrency, formatDate, formatMonthYear
```

---

## 5. Endpoints da API

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/auth/register` | Cadastro |
| POST | `/api/v1/auth/login` | Login → access_token + cookie refresh |
| POST | `/api/v1/auth/refresh` | Renovar access_token via cookie |
| POST | `/api/v1/auth/logout` | Invalidar refresh token |

### Rendas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/rendas` | Listar fontes de renda |
| POST | `/api/v1/rendas` | Adicionar fonte de renda |
| PATCH | `/api/v1/rendas/{id}` | Atualizar |
| DELETE | `/api/v1/rendas/{id}` | Remover |

### Dívidas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/dividas` | Listar dívidas |
| POST | `/api/v1/dividas` | Adicionar dívida |
| PATCH | `/api/v1/dividas/{id}` | Atualizar |
| PATCH | `/api/v1/dividas/{id}/quitar` | Marcar como quitada |
| DELETE | `/api/v1/dividas/{id}` | Remover |

### Contas a Pagar
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/contas-pagar` | Listar (filtros: status, mes, ano) |
| POST | `/api/v1/contas-pagar` | Criar — retorna lista (1 a N lançamentos) |
| PATCH | `/api/v1/contas-pagar/{id}` | Atualizar |
| PATCH | `/api/v1/contas-pagar/{id}/pagar` | Marcar como pago |
| DELETE | `/api/v1/contas-pagar/{id}` | Remover |

**Body POST — modalidades:**
```json
// Avulsa (1 lançamento)
{ "descricao": "...", "categoria": "moradia", "valor": 1500.00,
  "data_vencimento": "2026-04-05", "modalidade": "avulsa" }

// Recorrente (gera até dezembro)
{ ..., "modalidade": "recorrente" }

// Parcelada (gera N lançamentos)
{ ..., "modalidade": "parcelada", "numero_parcelas": 12 }
```

### Contas a Receber
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/contas-receber` | Listar (filtros: status, mes, ano) |
| POST | `/api/v1/contas-receber` | Criar — retorna lista (1 a N lançamentos) |
| PATCH | `/api/v1/contas-receber/{id}` | Atualizar |
| PATCH | `/api/v1/contas-receber/{id}/receber` | Marcar como recebido |
| DELETE | `/api/v1/contas-receber/{id}` | Remover |

### Dashboard
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/dashboard/resumo` | Métricas consolidadas |

### Relatórios
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/relatorio/fluxo-caixa?ano=2026` | Fluxo mensal do ano |
| GET | `/api/v1/relatorio/detalhado?mes=3&ano=2026` | Lançamentos do mês |

### Plano de Ação IA
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/plano-acao` | Buscar plano existente |
| POST | `/api/v1/plano-acao/gerar` | Gerar novo plano via IA |

---

## 6. Models do banco de dados

### `usuarios`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID PK | |
| nome | VARCHAR(150) | |
| email | VARCHAR(254) | único |
| senha_hash | TEXT | bcrypt |
| criado_em | TIMESTAMPTZ | |

### `rendas`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID PK | |
| usuario_id | UUID FK | CASCADE |
| descricao | VARCHAR(150) | |
| valor | NUMERIC(12,2) | |
| frequencia | VARCHAR(20) | mensal \| quinzenal \| semanal |
| tipo | VARCHAR(30) | salario \| freela \| aluguel \| outro |
| ativo | BOOLEAN | default true |

### `dividas`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID PK | |
| usuario_id | UUID FK | CASCADE |
| descricao | VARCHAR(150) | |
| credor | VARCHAR(100) | |
| valor_total | NUMERIC(12,2) | |
| valor_parcela | NUMERIC(12,2) | |
| taxa_juros | NUMERIC(6,4) | |
| data_vencimento | DATE | |
| quitada | BOOLEAN | default false |

### `contas_a_pagar`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID PK | |
| usuario_id | UUID FK | CASCADE |
| descricao | VARCHAR(150) | |
| categoria | VARCHAR(50) | moradia \| transporte \| saude \| educacao \| alimentacao \| lazer \| outro |
| valor | NUMERIC(12,2) | |
| data_vencimento | DATE | indexado |
| status | VARCHAR(20) | pendente \| pago \| vencido |
| tipo | VARCHAR(20) | fixa \| variavel \| avulsa |
| pago_em | TIMESTAMPTZ | nullable |
| observacao | TEXT | nullable |

### `contas_a_receber`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID PK | |
| usuario_id | UUID FK | CASCADE |
| descricao | VARCHAR(150) | |
| origem | VARCHAR(30) | salario \| freela \| venda \| emprestimo \| outro |
| tipo | VARCHAR(20) | avulsa \| recorrente \| parcelada |
| valor | NUMERIC(12,2) | |
| data_prevista | DATE | indexado |
| status | VARCHAR(20) | pendente \| recebido \| atrasado |
| devedor | VARCHAR(150) | nullable |
| recebido_em | TIMESTAMPTZ | nullable |
| observacao | TEXT | nullable |

---

## 7. Migrations

| Arquivo | Descrição |
|---------|-----------|
| `50cce3ecfaee` | Schema inicial: usuarios, rendas, dividas, plano_acao |
| `a2f3c4e5b6d7` | Tabelas contas_a_pagar e contas_a_receber |
| `b3c4d5e6f7a8` | Coluna `tipo` em contas_a_receber |

Comandos úteis:

```bash
alembic upgrade head          # Aplicar todas as migrations
alembic downgrade -1          # Reverter última migration
alembic history               # Ver histórico
alembic current               # Ver versão atual
```

---

## 8. Componentes frontend reutilizáveis

### `CurrencyInput`

Localização: `src/components/ui/CurrencyInput.tsx`

Uso com `react-hook-form`:

```tsx
import { Controller } from 'react-hook-form'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

<Controller
  name="valor"
  control={control}
  render={({ field }) => (
    <CurrencyInput {...field} className="input-field" />
  )}
/>
```

**Comportamento:**
- Ao digitar: aceita `1500,00`
- Ao perder foco: formata para `1.500,00`
- `onChange` emite `number` (compatível com Zod `z.number()`)

---

## 9. Padrões de código

### Backend
- Rotas: `snake_case` nos arquivos e funções
- Validação com Pydantic `field_validator` e `model_validator`
- Banco de dados: sempre `async/await` com `AsyncSession`
- IDs: sempre UUID v4
- Datas: `date` (sem hora) para vencimentos, `datetime(timezone=True)` para timestamps
- Retorno de criação em lote: sempre `list[Model]`

### Frontend
- Componentes: `PascalCase`
- Arquivos de página: `NomeDaPaginaPage.tsx`
- Queries TanStack: `queryKey` como array com identificadores descritivos
- Formulários: sempre `react-hook-form` + `zodResolver`
- Valores monetários: sempre `CurrencyInput` via `Controller`
- Importações: path alias `@/` configurado no `tsconfig.json`

---

## 10. Variáveis de ambiente

### Backend (`.env`)

```env
DATABASE_URL=postgresql+asyncpg://postgres:senha@localhost:5432/equili
SECRET_KEY=chave-aleatoria-minimo-32-caracteres
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
OPENROUTER_API_KEY=sk-or-v1-sua_chave_aqui
OPENROUTER_CHAT_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_FALLBACK_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_DISABLE_REASONING=true
```

### Frontend

O frontend consome a API via proxy configurado no `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

---

## 11. Deploy (referência futura)

| Componente | Plataforma sugerida |
|------------|---------------------|
| Frontend | Vercel / Netlify (build `npm run build`) |
| Backend | Railway / Render / VPS com Docker |
| Banco de dados | Supabase / Railway PostgreSQL / Neon |
| Variáveis de ambiente | Configurar no painel do provedor |
