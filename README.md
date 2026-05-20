# Equili 🌿

> Controle financeiro familiar com IA — liberdade financeira ao alcance de todos.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 async · Alembic |
| Frontend | React 18 · Vite 5 · TypeScript · Tailwind CSS 3 |
| Banco | PostgreSQL 16 |
| IA | GitHub Models API (GPT-4o-mini) |
| Auth | JWT (access token em memória + refresh em httpOnly cookie) |

---

## Pré-requisitos

- Python 3.12+
- Node.js 20+
- PostgreSQL 16 rodando localmente
- Conta no GitHub (para gerar token de acesso ao GitHub Models)

---

## Setup rápido

### 1 · Variáveis de ambiente

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edite `backend/.env` com seus valores reais (especialmente `DATABASE_URL`, `SECRET_KEY` e `GITHUB_TOKEN`).
No frontend, mantenha apenas variáveis `VITE_` (públicas por definição do Vite).

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

## Plano gratuito

| Recurso | Limite |
|---------|--------|
| Dívidas ativas | 3 |
| Gerações de plano IA/mês | 3 |
| Exportar PDF | ❌ |
| Multi-usuário (família) | ❌ |

---

## Contribuindo

1. Fork + branch (`feat/minha-feature`)
2. Commits semânticos (`feat:`, `fix:`, `chore:`)
3. Abra um PR descritivo

---

## Licença

MIT
