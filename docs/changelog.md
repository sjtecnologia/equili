# Changelog — Equili

Histórico completo de desenvolvimento do projeto.

---

## [0.6.0] — 9 de outubro de 2026

### Adicionado
- **Sistema de planos e assinaturas (3 níveis)** com catálogo central em `app/core/planos.py` (única fonte da verdade para preços, recursos e limites por plano):
  - **Gratuito** — dívidas (3 ativas), 1 cartão, Plano de Ação IA (3/mês), Chat IA (15 msgs/mês), 1 meta; sem investimentos, contas bancárias, voz, exportação, NFS-e ou multi-usuário.
  - **Premium (R$ 19,90/mês)** — tudo ilimitado + investimentos, contas bancárias/cartões ilimitados, assistente de voz, exportação Excel, relatório detalhado/avançado.
  - **Pro / Família (R$ 34,90/mês)** — tudo do Premium + NFS-e, IA prioritária e multi-usuário (até 6 membros — **em breve**).
- **Endpoints**: `GET /planos` (catálogo público) e `GET /planos/me` (entitlements + uso do mês).
- **Enforcement generalizado**: recursos pagos respondem **402** e cotas de volume **429** (nada de 403, que o app interpreta como login expirado). Gates aplicados em investimentos, contas bancárias, NFS, voz, relatório detalhado e em todas as cotas (dívidas, cartões, Plano de Ação IA, chat IA).
- **Tabela `uso_ia`** (migration `e1a2b3c4d5e6`) para cotas mensais do chat IA.
- **Frontend**: página `/planos` (cards de preço + comparativo), hook `usePlano`, componente `Paywall`, item "Meu Plano" na navegação, cartão de plano nas Configurações, gates nas páginas de Investimentos, Contas e Cartões, NFS, Relatórios (aba detalhado + exportação) e limites dinâmicos em Dívidas.
- **Testes** `tests/test_planos.py` (11 casos) cobrindo catálogo, entitlements e gating por plano.

### Notas
- **Pagamento online (Stripe) e multi-usuário/família são fase 2** — a troca de plano continua manual pelo admin; a página `/planos` direciona o contato para ativação.
- Migration Alembic necessária: `alembic upgrade head` (cria a tabela `uso_ia`).

---

## [0.5.0] — 9 de outubro de 2026

### Modificado
- **Provedor de IA migrado de GitHub Models para OpenRouter** (`https://openrouter.ai`), usando modelos gratuitos (IDs com sufixo `:free`):
  - Novo cliente central `app/services/openrouter.py` (substitui `app/services/github_models.py`, removido).
  - Modelo primário: `nvidia/nemotron-3-super-120b-a12b:free` (forte e rápido com reasoning desligado).
  - Modelo de **fallback automático**: `google/gemma-4-26b-a4b-it:free` (outro vendor, também com `response_format`), acionado em falhas do modelo/upstream (`400/404/408/429/500/502/503/504` — p.ex. `:free` fora de estoque ou congestão do provedor).
  - **Reasoning desligado por padrão** (`OPENROUTER_DISABLE_REASONING`, `reasoning: {"enabled": false}`): evita que modelos de raciocínio consumam o `max_tokens` e truncar o JSON. Se o modelo exigir reasoning (ex.: retorna 400 "mandatory"), o cliente reenvia a chamada sem o parâmetro automaticamente.
  - Mantidos retry com backoff para `429/503` e tratamento de timeout.
- **Config** (`app/core/config.py`): variáveis `GITHUB_*` substituídas por `OPENROUTER_BASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL`, `OPENROUTER_FALLBACK_MODEL` e `OPENROUTER_DISABLE_REASONING`.
- **Rotas atualizadas** para o novo cliente: `plano_acao.py`, `chat.py` e `voz.py` (assistente de voz deixou de usar chamadas `httpx` diretas).
- **Docs e exemplos** atualizados: `README.md`, `.env.example`, `backend/.env.example`, `docs/architecture.md`, `docs/dev-guide.md`, `docs/deploy-checklist.md` e `backend/scripts/rotacionar_env.sh`.
- **Testes** `test_plano_acao.py` e `test_plano_acao_resumo.py` ajustados para as novas variáveis.

### Notas
- Modelos gratuitos do OpenRouter têm limites: **20 req/min** e **50 req/dia** (ou 1.000/dia após comprar US$ 10 em créditos).
- Antes de trocar o modelo primário, confirme que ele aceita `response_format` em https://openrouter.ai/models?max_price=0 (o Plano de Ação depende disso). Também prefira modelos que aceitem reasoning desligado, para não truncar o JSON.

---

## [0.4.0] — 30 de março de 2026

### Adicionado
- **Tela de Relatórios** (`/relatorios`) com duas abas:
  - **Fluxo de Caixa anual**: gráfico de barras (Recharts) com Entradas vs Saídas por mês, cards de totais e tabela com os 12 meses
  - **Relatório Detalhado por mês**: cards de resumo, tabela de Contas a Receber e tabela de Contas a Pagar com status colorido
- **Exportação para Excel** via SheetJS (`xlsx`) em ambas as abas:
  - Fluxo de Caixa → planilha única `fluxo_caixa_YYYY.xlsx`
  - Relatório Detalhado → workbook com 3 abas: Resumo, Contas a Receber, Contas a Pagar → `relatorio_YYYY_MM.xlsx`
- **Backend** — dois novos endpoints em `/relatorio`:
  - `GET /relatorio/fluxo-caixa?ano=YYYY` — retorna 12 objetos `{mes, mes_nome, entradas, saidas, saldo}`
  - `GET /relatorio/detalhado?mes=M&ano=YYYY` — retorna lançamentos detalhados do mês com totais
- Item **Relatórios** adicionado ao BottomNav (mobile) e Sidebar (desktop)

### Pacotes adicionados
- `xlsx` ^0.18.x — exportação de Excel no cliente (SheetJS)

---

## [0.3.0] — 30 de março de 2026

### Adicionado
- **Modalidade de lançamento** em Contas a Pagar e Contas a Receber:
  - `avulsa` — lançamento único
  - `recorrente` — gera lançamentos mensais do mês inicial até dezembro do mesmo ano (ideal para água, luz, internet)
  - `parcelada` — gera N lançamentos mensais com `"Descrição (1/N)"` na descrição (ideal para financiamentos e carnês)
- **Modal adaptativo** com seletor visual de 3 cards para a modalidade
- **Info box** azul ao selecionar "Recorrente" indicando quantos lançamentos serão criados
- **Campo número de parcelas** exibido condicionalmente quando modalidade = parcelada
- **Toast de sucesso** verde exibindo "X lançamentos criados" ao salvar em lote
- **Badges** nos cards da lista: ícone `RefreshCw` para recorrente, `Layers` para parcelada
- **Componente `CurrencyInput`** (`src/components/ui/CurrencyInput.tsx`):
  - Formatação automática pt-BR (ex.: `1.500,00`)
  - Ao focar: remove separador de milhar para edição fácil (`1500,00`)
  - Compatível com `react-hook-form` via `Controller`
  - Aplicado em: `RendaPage`, `DividasPage`, `ContasPagarPage`, `ContasReceberPage`
- **Dump SQL** do banco de dados gerado em `database_dump.sql`

### Modificado
- `ContasPagarPage.tsx` — modal completamente reescrito com seletor de modalidade
- `ContasReceberPage.tsx` — modal completamente reescrito com seletor de modalidade
- `RendaPage.tsx` — campo valor substituído por `CurrencyInput`
- `DividasPage.tsx` — campo valor_total substituído por `CurrencyInput`

### Backend
- `contas_pagar.py` — reescrito com lógica de geração em lote:
  - Helper `_add_months(dt, n)` com tratamento de fim de mês
  - Schema `ContaAPagarCreate` com `modalidade` e `numero_parcelas`
  - Validador `model_validator` que exige `numero_parcelas >= 2` para parcelada
  - Endpoint `POST /contas-pagar` retorna `list[ContaAPagar]`
- `contas_receber.py` — mesma lógica adaptada para recebimentos
- `conta_lancamento.py` — campo `tipo` adicionado ao model `ContaAReceber`
- Migration `b3c4d5e6f7a8` — `add_tipo_to_contas_receber`

---

## [0.2.0] — 29 de março de 2026

### Adicionado
- **Tela Contas a Pagar** (`/contas-pagar`) — CRUD completo:
  - Listagem com filtro por status (Todos / Pendente / Vencido / Pago)
  - Cards com valor, categoria, vencimento e badge de status colorido
  - Alerta visual para contas vencidas (borda vermelha + ícone)
  - Ação "Marcar como pago" com `PATCH /contas-pagar/{id}/pagar`
  - Exclusão com confirmação implícita
  - Cards de resumo: "A pagar" e "Já pago"
- **Tela Contas a Receber** (`/contas-receber`) — CRUD completo:
  - Listagem com filtro por status (Todos / Pendente / Atrasado / Recebido)
  - Ação "Marcar como recebido" com `PATCH /contas-receber/{id}/receber`
  - Cards de resumo: "A receber" e "Já recebido"
- **Backend** — rotas completas para `contas-pagar` e `contas-receber`:
  - `GET`, `POST`, `PATCH /{id}`, `PATCH /{id}/pagar`, `DELETE /{id}`
- **Models** `ContaAPagar` e `ContaAReceber` em `conta_lancamento.py`
- **Migration** `a2f3c4e5b6d7` — criação das tabelas `contas_a_pagar` e `contas_a_receber`
- BottomNav e Sidebar atualizados com os novos itens

---

## [0.1.0] — 24–28 de março de 2026 (Sprint 1)

### Adicionado
- **Infraestrutura base**: monorepo `frontend/` + `backend/`, venv Python, Vite + React + TypeScript
- **Autenticação** com JWT:
  - `POST /auth/register` — cadastro com hash bcrypt
  - `POST /auth/login` — retorna `access_token` (Bearer) + `refresh_token` (httpOnly cookie)
  - `POST /auth/refresh` — renovação silenciosa do access token no boot do app
  - `POST /auth/logout`
- **Tela de Login** e **Cadastro** com validação Zod
- **Onboarding** guiado em 3 etapas: Renda → Dívida → Confirmar
- **Dashboard** com cards de métricas: Renda Total, Despesas Fixas, Saldo Disponível, Dívidas Ativas
- **Tela de Rendas** (`/renda`) — CRUD: adicionar/remover fontes de renda
- **Tela de Dívidas** (`/dividas`) — CRUD com progresso de quitação e confetti ao quitar
- **Tela Plano de Ação IA** (`/plano-de-acao`) — integração com GitHub Models API (GPT-4o)
- **AppLayout** com Sidebar (desktop) + BottomNav (mobile)
- Utilitários `formatCurrency`, `formatDate`, `formatMonthYear` em `utils/format.ts`
- `authStore` (Zustand) para gerenciamento de token
- `api.ts` (Axios) com interceptor de `Authorization: Bearer` e renovação automática por 401
- `run_server.py` para iniciar o backend com configuração de CORS
- **Migration** `50cce3ecfaee` — schema inicial (usuarios, rendas, dividas, plano_acao)
