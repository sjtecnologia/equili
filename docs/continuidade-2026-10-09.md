# Continuidade — sessão 09/10/2026

Documento de retomada da conversa do dia 09/10/2026 no OpenCode.
Se você chegou aqui depois de uma pausa, leia este arquivo antes de continuar.

---

## 1. O que já está FEITO e PUSHADO (origin/main)

Fase 2 do sistema de assinaturas **concluída** — todos os commits abaixo estão em `origin/main`:

| Commit | Conteúdo |
|---|---|
| `0f55ca3` | Migração da IA: GitHub Models → OpenRouter (modelos `:free`) |
| `72dfaee` | Sistema de assinaturas em 3 níveis (Gratuito / Premium R$ 19,90 / Pro-Família R$ 34,90) com gating 402/429 |
| `137686d` | Biometria Android + nome do app iOS |
| `da5d33b` | **Metas** (CRUD + aportes + conclusão automática) — Bloco 1 |
| `687049f` | **Exportação PDF/NFS** (`jspdf`, gate `podeExportar`) — Bloco 2 |
| `4f1912a` | **Cobrança** (checkout PIX/cartão, gateway agnóstico + mock, webhook assinado) — Bloco 3 |
| `a789c86` | **Multi-usuário/Família** (convites por token, dados separados, plano dos membros espelha o titular) — Bloco 4 |
| `b7e9bdb` | Correção: tela do Plano de Ação passou a exibir os passos da IA |
| `29b6a7b` | Prompt profissional do Plano de Ação (passos ancorados, ordem avalanche injetada, fases) |

**Convenções de gates**: limites 𝑚arcam **429**; recursos pagos **402**; Excel segue Premium; PDF segue o mesmo gate de exportação.

**Validação**: backend 102 tests passando (só 3 falhas pré-existentes de `test_email_verification.py` — SQLite/JSONB); frontend `tsc -b`, ESLint e `vite build` limpos.

---

## 2. Pendências ativas (para retomar)

### 2.1 — Vulnerabilidades Dependabot (PRIORIDADE 1)
GitHub reportou **129 vulnerabilidades** (10 críticas, 65 altas, 48 moderadas). Diagnóstico iniciado:
- `npm audit fix` (não-forçado) **já rodou** uma vez no `frontend/` — o resultado final precisa ser reavaliado (`npm audit` de novo).
- Pacotes-chave identificados:
  - `@capacitor/android` e `@capacitor/ios` **8.0.0–8.3.4** — crítico; fix disponível via `npm audit fix` (bump do `^8.3.0`).
  - `axios` — high; fix disponível.
  - `@xmldom/xmldom` — high (via `@trapezedev/project`, tooling dev).
  - `xlsx@0.18.5` — high, **SEM FIX NO NPM** (SheetJS). Solução padrão: instalar a versão corrigida do CDN oficial:
    ```sh
    npm install xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
    ```
  - `tinypool` (via `vitest@1.x`) — alto; corrigir exige `vitest@5` (breaking, `npm audit fix --force`) — avaliar upgrade do Vitest.
  - `tmp`, `uuid` (via `xcode`) — medium/high, tooling dev do Capacitor.
  - `brace-expansion` (transitiva, via glob) — alta.
- **Backend (pip) NÃO foi auditado** — `pip-audit` não está instalado no venv. Instalar com `.venv/bin/pip install pip-audit` e rodar `pip-audit -r requirements.txt`.

### 2.2 — EasePanel: "Github token is not valid"
- O deploy no EasePanel está **bloqueado** até reconectar um PAT novo (Settings/Integrations → GitHub).
- A `OPENROUTER_API_KEY` deve ser configurada na aba **Environment** do serviço do backend no EasePanel (nome exato, sem aspas). A chave funciona (testada com HTTP 200 no `https://openrouter.ai/api/v1/models`).
- Depois do deploy limpo: rodar `alembic upgrade head` (4 migrations novas: metas, assinaturas/pagamentos, membros_familia) e **Regenerar** o Plano de Ação para validar o novo prompt.

### 2.3 — Teste manual do novo Plano de Ação
Prompts novos exigem verificação real com o usuário (Ana?) — o plano deve sair com fases (imediato/curto/médio), passos citando credores e valores reais (ordem avalanche injetada).

---

## 3. Comandos úteis

```bash
# Backend — testes
cd backend && .venv/bin/python -m pytest

# Frontend — validações
cd frontend && npx tsc -b && npx eslint . --max-warnings 0 && npx vite build

# Segurança
cd frontend && npm audit        # reavaliar após os fixes
cd backend && .venv/bin/pip install pip-audit && .venv/bin/pip-audit -r requirements.txt

# Migrações (deploy)
cd backend && .venv/bin/alembic upgrade head
```

---

## 4. Estado da árvore no fim da sessão

- Branch: `main`, tudo pushado em `origin/main` (7+ commits à frente de onde a semana começou).
- Volume `/Volumes/Projects` já desconectou 1x — nada se perdeu, mas **puxe/commit antes de desligar a VM**.
- `.env` do backend é gitignored (chaves não sobem para o GitHub).