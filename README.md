# Equili 🌿

> Controle financeiro familiar com IA — liberdade financeira ao alcance de todos.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 async · Alembic |
| Frontend | React 18 · Vite 5 · TypeScript · Tailwind CSS 3 |
| Banco | PostgreSQL 16 |
| IA | OpenRouter (modelos gratuitos `:free`) |
| Auth | JWT (access token em memória + refresh em httpOnly cookie) |

---

## Pré-requisitos

- Python 3.12+
- Node.js 20+
- PostgreSQL 16 rodando localmente
- Conta no [OpenRouter](https://openrouter.ai) (para gerar a API key — modelos `:free` são gratuitos)

---

## Setup rápido

### 1 · Variáveis de ambiente

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edite `backend/.env` com seus valores reais (especialmente `DATABASE_URL`, `SECRET_KEY` e `OPENROUTER_API_KEY`).
No frontend, mantenha apenas variáveis `VITE_` (públicas por definição do Vite).
Se usar login social, configure também `GOOGLE_CLIENT_ID` e `APPLE_ALLOWED_AUDIENCES` no backend.
Para rate limiting distribuído (multi-instância), configure também `REDIS_URL` no backend.

### 2 · Criar o banco de dados

```bash
psql -U postgres -c "CREATE DATABASE equili;"
```

### 3 · Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Rodar migrações
alembic upgrade head

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

### 4 · Frontend

```bash
cd frontend
npm install
npm run dev
```

### Ou tudo de uma vez (macOS / Linux)

```bash
chmod +x run_dev.sh
./run_dev.sh
```

---

## Acessos locais

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| Docs API | http://localhost:8000/docs |

---

## Estrutura do projeto

```
equili/
├── backend/
│   ├── .env.example
│   ├── app/
│   │   ├── api/v1/routes/      # auth, rendas, dividas, plano_acao, dashboard
│   │   ├── core/               # config, security, dependencies
│   │   ├── db/                 # base, session
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   └── main.py
│   ├── alembic/                # migrações
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/layout/  # AppLayout, Sidebar, BottomNav
│   │   ├── pages/              # auth, dashboard, renda, dividas, plano-de-acao, onboarding
│   │   ├── services/           # api.ts (Axios)
│   │   ├── stores/             # authStore (Zustand)
│   │   └── utils/              # format.ts
│   └── ...
├── docs/
│   ├── project-brief.md
│   ├── prd.md
│   ├── ux-spec.md
│   ├── architecture.md
│   └── backlog.md
├── .env.example
├── frontend/.env.example
├── .gitignore
└── run_dev.sh
```

---

## Planos e assinaturas

| Recurso | Gratuito | Premium (R$ 19,90/mês) | Pro / Família (R$ 34,90/mês) |
|---------|----------|------------------------|------------------------------|
| Dívidas ativas | 3 | Ilimitado | Ilimitado |
| Cartões de crédito | 1 | Ilimitado | Ilimitado |
| Plano de Ação IA | 3/mês | Ilimitado | Ilimitado + prioridade |
| Chat IA | 15 msgs/mês | Ilimitado | Ilimitado |
| Investimentos | ❌ | ✅ | ✅ |
| Contas bancárias | ❌ | ✅ | ✅ |
| Assistente de voz | ❌ | ✅ | ✅ |
| Exportação Excel | ❌ | ✅ | ✅ |
| Relatório detalhado | ❌ | ✅ | ✅ + avançados |
| NFS-e | ❌ | ❌ | ✅ |
| Família (membros) | 1 | 2 | 6 (em breve) |

Fonte da verdade: `backend/app/core/planos.py`. Endpoints `GET /planos` e `GET /planos/me`.
Recursos pagos respondem `402`; cotas de volume respondem `429`. Detalhes na página `/planos` do app.

> **Pagamento online (Stripe/PIX) e multi-usuário são fase 2.** A troca de plano hoje é feita pelo
> administrador; a página `/planos` direciona o contato para ativação.

---

## Contribuindo

1. Fork + branch (`feat/minha-feature`)
2. Commits semânticos (`feat:`, `fix:`, `chore:`)
3. Abra um PR descritivo

---

## Licença

MIT
