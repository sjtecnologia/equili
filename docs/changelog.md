# Changelog — Equili

Histórico completo de desenvolvimento do projeto.

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
