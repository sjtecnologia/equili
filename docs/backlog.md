# Backlog — Equili

**Versão:** 1.0
**Data:** 24 de março de 2026
**Product Owner:** Sarah (BMad PO Agent)
**Status:** Pronto para Desenvolvimento

---

## Estratégia de Sprints

**Abordagem escolhida:** Fluxo completo mínimo — validar o diferencial do produto
(auth → renda → dívida → plano IA) antes de construir o restante.

> **Princípio:** Um usuário que entra, cadastra sua renda, adiciona 1 dívida
> e recebe um plano de ação já experimenta o valor central do Equili.
> Isso é o que o Sprint 1 deve entregar.

---

## Sprint 1 — Fluxo Completo Mínimo (2 semanas)

**Objetivo:** Um usuário consegue se cadastrar, informar renda e 1 dívida, e receber um plano de ação gerado pela IA.

**Critério de conclusão do sprint:** Demo funcional end-to-end do fluxo acima.

---

### SETUP — Infraestrutura Base

#### SETUP-01 — Estrutura do repositório
**Tipo:** Técnico | **Prioridade:** Crítica | **Status:** A fazer

**Descrição:** Criar estrutura do monorepo conforme arquitetura definida.

**Tarefas técnicas:**
- [ ] Criar estrutura de pastas `frontend/` e `backend/` conforme `architecture.md`
- [ ] Configurar `backend/`: FastAPI, SQLAlchemy async, Alembic, venv, `requirements.txt`
- [ ] Configurar `frontend/`: React + Vite + TypeScript + Tailwind CSS
- [ ] Criar `.env.example` com todas as variáveis necessárias
- [ ] Criar `run_dev.sh` para iniciar ambos os serviços
- [ ] Criar `README.md` com instruções de setup

**Critérios de aceite:**
- [ ] `uvicorn app.main:app --reload` sobe sem erros em `http://localhost:8000`
- [ ] `npm run dev` sobe sem erros em `http://localhost:5173`
- [ ] `http://localhost:8000/docs` exibe Swagger UI do FastAPI
- [ ] Banco de dados `equili_dev` criado e acessível

---

#### SETUP-02 — Banco de dados e migrations iniciais
**Tipo:** Técnico | **Prioridade:** Crítica | **Status:** A fazer

**Dependência:** SETUP-01

**Tarefas técnicas:**
- [ ] Criar modelos SQLAlchemy: `Usuario`, `Renda`, `Divida`, `PlanoAcao`
- [ ] Criar migration Alembic inicial com todas as tabelas do Sprint 1
- [ ] Criar índices conforme `architecture.md`
- [ ] Validar integridade referencial com ON DELETE CASCADE

**Critérios de aceite:**
- [ ] `alembic upgrade head` executa sem erros
- [ ] Tabelas criadas corretamente no PostgreSQL
- [ ] `alembic downgrade -1` funciona (reversibilidade)

---

### ÉPICO 1 — Autenticação

#### E1-S1-01 — Backend: Endpoints de autenticação
**Tipo:** Backend | **Prioridade:** Crítica | **Story Points:** 5

**Dependência:** SETUP-02

**Como** sistema, **quero** endpoints seguros de autenticação **para que** usuários possam se cadastrar e fazer login.

**Endpoints a implementar:**
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

**Critérios de aceite:**
- [ ] Registro valida email único — retorna `409` se duplicado
- [ ] Senha hasheada com bcrypt (mínimo 12 rounds)
- [ ] Login retorna `access_token` (JWT, 30min) + `refresh_token` (httpOnly cookie, 30 dias)
- [ ] Erro de login retorna mensagem genérica (não especifica se email ou senha estão errados)
- [ ] Refresh token rotativo — emissor invalida o anterior ao gerar novo
- [ ] UUID como PK (não ID sequencial)
- [ ] Todos os endpoints testados (pytest)

---

#### E1-S1-02 — Frontend: Telas de Login e Cadastro
**Tipo:** Frontend | **Prioridade:** Crítica | **Story Points:** 3

**Dependência:** E1-S1-01

**Como** novo usuário, **quero** me cadastrar e fazer login **para que** eu possa acessar o sistema.

**Tarefas:**
- [ ] Tela de Login (`/login`) com email + senha + "Lembrar de mim"
- [ ] Tela de Cadastro (`/cadastro`) com nome, email, senha, confirmação de senha
- [ ] Validação client-side com React Hook Form + Zod
- [ ] Armazenar `access_token` em memória (não localStorage)
- [ ] Interceptor Axios: renovar token automaticamente via refresh
- [ ] Redirecionar para `/dashboard` após login bem-sucedido
- [ ] Redirecionar para `/login` em rotas protegidas sem autenticação

**Critérios de aceite:**
- [ ] Formulários validam antes de submeter
- [ ] Mensagens de erro claras e empáticas (seguir UX spec)
- [ ] Loading state no botão durante requisição
- [ ] Funcional em mobile (≥ 320px)

---

### ÉPICO 2 — Renda

#### E2-S1-01 — Backend: CRUD de rendas
**Tipo:** Backend | **Prioridade:** Alta | **Story Points:** 2

**Dependência:** E1-S1-01

**Endpoints:**
- `GET /api/v1/rendas`
- `POST /api/v1/rendas`
- `PATCH /api/v1/rendas/{id}`
- `DELETE /api/v1/rendas/{id}`

**Critérios de aceite:**
- [ ] Todos os endpoints exigem autenticação JWT
- [ ] Usuário só acessa suas próprias rendas (verificação por `usuario_id`)
- [ ] Validação Pydantic: valor > 0, frequência válida, tipo válido
- [ ] DELETE valida que renda pertence ao usuário autenticado

---

#### E2-S1-02 — Frontend: Cadastro de renda no onboarding
**Tipo:** Frontend | **Prioridade:** Alta | **Story Points:** 2

**Dependência:** E2-S1-01

**Tarefas:**
- [ ] Componente `RendaForm` (descrição, valor, frequência, tipo)
- [ ] Input de valor com máscara monetária R$ automática
- [ ] Lista de rendas cadastradas com total calculado em tempo real
- [ ] Opção de adicionar múltiplas fontes
- [ ] Edição e remoção inline

**Critérios de aceite:**
- [ ] Total da renda mensal atualiza ao adicionar/remover
- [ ] Máscara monetária formata corretamente (ex: 5000 → R$ 5.000,00)

---

### ÉPICO 4 — Dívidas

#### E4-S1-01 — Backend: CRUD de dívidas
**Tipo:** Backend | **Prioridade:** Alta | **Story Points:** 3

**Dependência:** E2-S1-01

**Endpoints:**
- `GET /api/v1/dividas`
- `POST /api/v1/dividas`
- `PATCH /api/v1/dividas/{id}`
- `DELETE /api/v1/dividas/{id}`

**Critérios de aceite:**
- [ ] Verificação de limite: plano grátis → máx. 3 dívidas ativas, retorna `403` com mensagem clara
- [ ] Validação: valor_total > 0, parcelas_restantes ≥ 0, data_prox_vencimento válida
- [ ] Usuário só acessa suas próprias dívidas
- [ ] Endpoint `GET /dividas` retorna ordenado por data_prox_vencimento

---

#### E4-S1-02 — Frontend: Cadastro de dívida no onboarding
**Tipo:** Frontend | **Prioridade:** Alta | **Story Points:** 3

**Dependência:** E4-S1-01

**Tarefas:**
- [ ] Componente `DividaForm` com todos os campos do schema
- [ ] Selector de tipo de dívida com ícones descritivos
- [ ] Date picker para data de vencimento
- [ ] Banner de limite do plano grátis (visível ao atingir 3 dívidas)
- [ ] Card de dívida com barra de progresso e badge de prioridade (placeholder)
- [ ] Total geral de dívidas calculado e exibido

**Critérios de aceite:**
- [ ] Formulário valida todos os campos obrigatórios
- [ ] Banner de upgrade exibido ao tentar cadastrar 4ª dívida no plano grátis
- [ ] Card de dívida exibe: nome, credor, valor restante, próxima parcela, tipo

---

### ÉPICO 5 — Plano de Ação IA ⭐ (Core do Produto)

#### E5-S1-01 — Backend: Serviço de geração do Plano de Ação
**Tipo:** Backend | **Prioridade:** Crítica | **Story Points:** 8

**Dependência:** E2-S1-01, E4-S1-01

**Endpoints:**
- `POST /api/v1/plano-acao/gerar`
- `GET /api/v1/plano-acao/atual`

**Tarefas técnicas:**
- [ ] Implementar `PlanoIAService` conforme `architecture.md`
- [ ] Montar prompt com dados reais do usuário (renda, despesas, dívidas)
- [ ] Integrar GitHub Models API (httpx async, timeout 30s)
- [ ] Parsear resposta JSON + validar com Pydantic schema
- [ ] Salvar plano no banco (`planos_acao` tabela)
- [ ] Verificar cota: plano grátis → máx. 3 gerações/mês
- [ ] Tratamento de erro quando API LLM falha (retornar `503` com mensagem amigável)

**Critérios de aceite:**
- [ ] Plano gerado em ≤ 15 segundos (timeout configurado)
- [ ] Resposta contém: resumo_situacao, estrategia, ordem_quitacao, data_livre_prevista, sugestoes_economia
- [ ] Plano salvo no banco com tokens_usados e criado_em
- [ ] Cota verificada e `429` retornado ao exceder limite do plano grátis
- [ ] Logs sem dados financeiros sensíveis

---

#### E5-S1-02 — Frontend: Tela do Plano de Ação
**Tipo:** Frontend | **Prioridade:** Crítica | **Story Points:** 5

**Dependência:** E5-S1-01

**Tarefas:**
- [ ] Botão "Gerar meu Plano de Ação ✨" (habilitado só com renda + 1 dívida)
- [ ] Loading state com mensagens motivacionais rotativas (5 frases)
- [ ] Exibição estruturada do plano (não texto corrido):
  - Card: Resumo da situação (texto IA empático)
  - Card: Estratégia recomendada (avalanche/bola de neve) com explicação
  - Lista numerada: Ordem de quitação com data estimada por dívida
  - Destaque visual: "Você estará livre em [MÊS/ANO]"
  - Cards: 3 sugestões de economia
- [ ] Botões de feedback 👍 / 👎
- [ ] Estado "sem plano gerado" com CTA claro

**Critérios de aceite:**
- [ ] Loading state exibe mensagem motivacional enquanto aguarda IA
- [ ] Data de liberdade financeira exibida com destaque visual (conforme UX spec)
- [ ] Plano renderiza corretamente em mobile
- [ ] Erro de API (timeout, etc.) exibe mensagem empática ao usuário

---

### ÉPICO 6 — Dashboard (versão Sprint 1)

#### E6-S1-01 — Backend: Endpoint de resumo do dashboard
**Tipo:** Backend | **Prioridade:** Alta | **Story Points:** 2

**Dependência:** E2-S1-01, E4-S1-01

**Endpoint:** `GET /api/v1/dashboard/resumo`

**Resposta:**
```json
{
  "renda_total": 5000.00,
  "total_despesas_fixas": 0,
  "total_despesas_variaveis": 0,
  "total_dividas": 15000.00,
  "saldo_disponivel": 5000.00,
  "total_dividas_ativas": 1,
  "plano_gerado": true
}
```

**Critérios de aceite:**
- [ ] Retorna todos os campos em uma única chamada (evitar N+1)
- [ ] Valores calculados corretamente

---

#### E6-S1-02 — Frontend: Dashboard básico do Sprint 1
**Tipo:** Frontend | **Prioridade:** Alta | **Story Points:** 3

**Dependência:** E6-S1-01, E5-S1-02

**Tarefas:**
- [ ] Layout com sidebar (desktop) e bottom nav (mobile)
- [ ] 4 cards de métrica: Renda / Dívidas / Saldo Disponível / Dívidas ativas
- [ ] Banner de acesso rápido ao Plano de Ação IA
- [ ] Empty state amigável para usuários sem dados
- [ ] Cores: verde para positivo, âmbar para alertas, vermelho para negativo (conforme UX spec)

**Critérios de aceite:**
- [ ] Dashboard carrega em < 1s (dados do endpoint único)
- [ ] Responsivo: 1 coluna (mobile) → 4 colunas (desktop)
- [ ] Saldo negativo exibe mensagem de orientação (não de alerta)

---

### ÉPICO 1 — Onboarding

#### E1-S1-03 — Frontend: Fluxo de onboarding guiado
**Tipo:** Frontend | **Prioridade:** Alta | **Story Points:** 3

**Dependência:** E2-S1-02, E4-S1-02

**Tarefas:**
- [ ] Wizard de 3 etapas: (1) Renda → (2) Dívidas → (3) Gerar Plano
- [ ] Barra de progresso no topo
- [ ] Salvar progresso parcial (usuário pode pausar e voltar)
- [ ] Ao final da etapa 2: botão "Ver meu Plano de Ação" dispara geração

**Critérios de aceite:**
- [ ] Progresso salvo automaticamente a cada etapa concluída
- [ ] Usuário pode pular etapas e completar depois
- [ ] Ao concluir onboarding, redirecionar para dashboard com plano gerado visível

---

## Sprint 2 — Contas, Alertas e Dashboard Completo (2 semanas)

| ID | Título | Épico | Prioridade | Points |
|----|--------|-------|-----------|--------|
| E3-S2-01 | Backend: CRUD de contas fixas | Épico 3 | Alta | 2 |
| E3-S2-02 | Backend: CRUD de contas variáveis | Épico 3 | Alta | 2 |
| E3-S2-03 | Frontend: Tela de contas | Épico 3 | Alta | 4 |
| E7-S2-01 | Backend: Sistema de alertas de vencimento | Épico 7 | Alta | 3 |
| E7-S2-02 | Frontend: Tela de alertas | Épico 7 | Média | 2 |
| E6-S2-01 | Frontend: Gráfico rosca no dashboard | Épico 6 | Média | 2 |
| E4-S2-01 | Frontend: Marcar parcela como paga + celebração | Épico 4 | Alta | 2 |
| E5-S2-01 | Frontend: Histórico de planos (últimos 3) | Épico 5 | Média | 1 |
| E1-S2-01 | Backend: Verificação de email | Épico 1 | Alta | 2 |
| E1-S2-02 | Backend: Recuperação de senha | Épico 1 | Alta | 2 |

---

## Sprint 3 — Modelo de Negócio e Polimento (2 semanas)

| ID | Título | Épico | Prioridade |
|----|--------|-------|-----------|
| PAY-01 | Integração Stripe / Pagar.me (plano pago) | Pagamento | Alta |
| PAY-02 | Webhook de confirmação de pagamento | Pagamento | Alta |
| PAY-03 | Lógica de upgrade/downgrade de plano | Pagamento | Alta |
| EMAIL-01 | Email de boas-vindas (Resend) | Notificação | Média |
| EMAIL-02 | Email de alerta de vencimento (opt-in) | Notificação | Média |
| UX-01 | Animação de confetti ao quitar dívida | UX | Média |
| UX-02 | Landing page pública | UX | Alta |
| QA-01 | Testes E2E críticos (Playwright) | QA | Alta |
| SEC-01 | Auditoria de segurança pré-lançamento | Segurança | Crítica |

---

## Definição de Pronto (Definition of Done)

Uma história está **Pronta** quando:

- [ ] Código implementado e funcionando conforme critérios de aceite
- [ ] Testes unitários escritos (cobertura ≥ 80% nas funções de negócio)
- [ ] Sem erros de lint (backend: ruff / frontend: ESLint)
- [ ] PR revisado e aprovado
- [ ] Funciona em mobile e desktop
- [ ] Sem dados sensíveis em logs
- [ ] Merge na branch `main`

---

## Resumo do Sprint 1

| Métrica | Valor |
|---------|-------|
| Total de histórias | 11 |
| Story Points totais | ~39 |
| Duração estimada | 2 semanas |
| Entrega | Fluxo completo: cadastro → renda → dívida → plano IA |
| Demo possível no dia | ✅ |

---

## Status Geral do Projeto

| Artefato | Status |
|----------|--------|
| Project Brief | ✅ Concluído |
| PRD | ✅ Concluído |
| Especificação UI/UX | ✅ Concluído |
| Arquitetura Técnica | ✅ Concluído |
| Backlog | ✅ Concluído |
| **Desenvolvimento Sprint 1** | ⏳ Aguardando início |
