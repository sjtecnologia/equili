# PRD — Equili: Controle Financeiro Familiar com IA

**Versão:** 1.0
**Data:** 24 de março de 2026
**Product Manager:** John (BMad PM Agent)
**Status:** Aprovado para Arquitetura

---

## 1. Visão do Produto

### 1.1 Declaração de Visão

> O Equili é a plataforma que transforma famílias endividadas em famílias financeiramente equilibradas, entregando não apenas controle — mas um **plano de ação claro e personalizado via IA** para sair das dívidas.

### 1.2 Objetivo de Negócio

- Ser a referência em controle financeiro familiar com foco em **saída de dívidas** no Brasil
- Converter usuários gratuitos em pagantes através do valor entregue pelo plano de ação IA
- Atingir 10.000 usuários ativos nos primeiros 6 meses pós-lançamento

### 1.3 Métricas de Sucesso (KPIs)

| Métrica | Meta MVP (6 meses) |
|---------|-------------------|
| Usuários cadastrados | 10.000 |
| Taxa de conversão gratuito → pago | ≥ 5% |
| Retenção mensal (D30) | ≥ 40% |
| NPS (Net Promoter Score) | ≥ 50 |
| Planos de ação gerados | ≥ 30.000 |
| Tempo médio de onboarding completo | ≤ 10 min |

---

## 2. Personas de Usuário

### Persona 1 — Ana, a Endividada (Primária)
- **Perfil:** 34 anos, casada, 2 filhos, renda familiar R$ 5.000/mês
- **Situação:** 4 dívidas ativas (cartão, empréstimo, financiamento do carro, cheques)
- **Dor:** Não sabe por onde começar, sente vergonha, conflitos com o marido sobre dinheiro
- **Objetivo:** Ter um plano claro e sair das dívidas em 2 anos
- **Comportamento:** Usa smartphone, não tem familiaridade com planilhas

### Persona 2 — Carlos, o Equilibrado (Secundário)
- **Perfil:** 42 anos, casado, sem dívidas, renda R$ 12.000/mês
- **Situação:** Quer organizar melhor as finanças para não cair em dívidas
- **Dor:** Perde o controle dos gastos variáveis, não tem visibilidade clara
- **Objetivo:** Manter equilíbrio e começar a investir
- **Comportamento:** Usa computador e celular, já tentou outras apps financeiras

---

## 3. Requisitos por Fase

---

### FASE 1 — MVP (Lançamento)

#### Épico 1: Autenticação e Perfil

**E1-US01** — Cadastro de usuário
- Como novo usuário, quero me cadastrar com email e senha para acessar o sistema
- **Critérios de aceite:**
  - Formulário com: nome completo, email, senha (mín. 8 caracteres, 1 maiúscula, 1 número)
  - Validação de email único
  - Confirmação por email (link de verificação)
  - Após confirmar, redirecionar para onboarding

**E1-US02** — Login
- Como usuário cadastrado, quero fazer login para acessar minha conta
- **Critérios de aceite:**
  - Login com email + senha
  - Opção "Lembrar de mim" (token persistente 30 dias)
  - Mensagem de erro genérica para email/senha inválidos (segurança)
  - Link "Esqueci minha senha" com redefinição via email

**E1-US03** — Onboarding guiado
- Como novo usuário, quero ser guiado no primeiro acesso para configurar meu perfil financeiro
- **Critérios de aceite:**
  - Fluxo de 4 etapas: (1) Perfil familiar, (2) Renda, (3) Contas fixas, (4) Dívidas
  - Barra de progresso visível
  - Possibilidade de pular etapas e completar depois
  - Ao final, gerar primeiro Plano de Ação IA automaticamente

---

#### Épico 2: Gestão de Renda

**E2-US01** — Cadastrar fonte de renda
- Como usuário, quero cadastrar minhas fontes de renda para o sistema conhecer meu orçamento
- **Critérios de aceite:**
  - Campos: descrição, valor, frequência (mensal/quinzenal/semanal), tipo (salário/freela/aluguel/outro)
  - Múltiplas fontes de renda permitidas
  - Valor total da renda mensal calculado automaticamente e exibido no dashboard

**E2-US02** — Editar/remover fonte de renda
- **Critérios de aceite:**
  - Edição inline ou modal
  - Confirmação antes de excluir
  - Dashboard atualizado em tempo real após alteração

---

#### Épico 3: Gestão de Contas e Despesas

**E3-US01** — Cadastrar conta fixa
- Como usuário, quero registrar minhas contas fixas mensais
- **Critérios de aceite:**
  - Campos: descrição, categoria (moradia/transporte/saúde/educação/outro), valor, dia de vencimento
  - Lista de categorias pré-definidas + opção "outro"
  - Alerta automático criado para 3 dias antes do vencimento

**E3-US02** — Cadastrar conta variável
- Como usuário, quero registrar gastos variáveis por categoria
- **Critérios de aceite:**
  - Campos: descrição, categoria (alimentação/lazer/vestuário/outro), valor estimado mensal
  - Possibilidade de lançar gastos variáveis avulsos ao longo do mês

**E3-US03** — Visualizar resumo de despesas
- Como usuário, quero ver o total de despesas fixas e variáveis do mês
- **Critérios de aceite:**
  - Separação clara: fixas / variáveis / dívidas
  - Comparativo: renda total vs. total de despesas
  - Indicador visual: saldo disponível (positivo = verde / negativo = vermelho)

---

#### Épico 4: Gestão de Dívidas

**E4-US01** — Cadastrar dívida
- Como usuário, quero registrar minhas dívidas para o Equili criar meu plano de quitação
- **Critérios de aceite:**
  - Campos: descrição, tipo (cartão parcelado/empréstimo pessoal/financiamento/cheque pré-datado/outro), valor total, valor da parcela, número de parcelas restantes, taxa de juros (opcional), data de vencimento da próxima parcela, credor
  - **Plano Grátis:** limite de 3 dívidas cadastradas com banner informativo para upgrade
  - **Plano Pago:** dívidas ilimitadas
  - Valor total de dívidas calculado e exibido no dashboard

**E4-US02** — Atualizar status de dívida
- Como usuário, quero marcar parcelas como pagas para acompanhar meu progresso
- **Critérios de aceite:**
  - Botão "Marcar parcela como paga" em cada dívida
  - Saldo devedor recalculado automaticamente
  - Animação/celebração visual ao quitar uma dívida completamente
  - Dívida quitada movida para histórico

**E4-US03** — Visualizar lista de dívidas
- **Critérios de aceite:**
  - Ordenação por: valor total, juros, vencimento mais próximo
  - Indicador de prioridade (baseado no Plano de Ação IA)
  - Total geral de dívidas no topo

---

#### Épico 5: Plano de Ação com IA (Core do Produto)

**E5-US01** — Gerar Plano de Ação IA
- Como usuário, quero que a IA analise minha situação financeira e gere um plano personalizado para sair das dívidas
- **Critérios de aceite:**
  - Botão "Gerar Plano de Ação" disponível após cadastrar ao menos 1 dívida + renda
  - IA analisa: renda disponível (renda - despesas fixas - variáveis), lista de dívidas com juros, perfil familiar
  - Plano gerado deve conter:
    - Resumo da situação atual em linguagem empática e encorajadora
    - Estratégia recomendada (avalanche = maior juros primeiro / bola de neve = menor valor primeiro) com justificativa
    - Ordem priorizada de quitação das dívidas
    - Valor sugerido a destinar para dívidas por mês
    - Projeção: mês e ano estimados para quitar cada dívida
    - Projeção: data estimada para estar 100% livre de dívidas
    - 3 sugestões de corte de gastos baseadas no perfil
  - **Plano Grátis:** máximo de 3 gerações por mês
  - **Plano Pago:** gerações ilimitadas
  - Loading state com mensagem motivacional durante processamento (máx. 15 segundos)

**E5-US02** — Visualizar e navegar pelo Plano de Ação
- **Critérios de aceite:**
  - Plano exibido de forma estruturada, não como texto corrido
  - Seções colapsáveis para não sobrecarregar visualmente
  - Botão de salvar/fixar plano atual
  - Histórico dos últimos 3 planos gerados

**E5-US03** — Feedback sobre o Plano
- Como usuário, quero dar feedback sobre o plano gerado para melhorá-lo
- **Critérios de aceite:**
  - Avaliação simples: 👍 / 👎
  - Campo opcional de comentário
  - Dados enviados como telemetria para melhoria do prompt

---

#### Épico 6: Dashboard

**E6-US01** — Dashboard principal
- Como usuário, quero ver um resumo da minha saúde financeira na tela inicial
- **Critérios de aceite:**
  - Cards principais:
    - Renda total mensal
    - Total de despesas (fixas + variáveis)
    - Total de dívidas
    - Saldo disponível
    - Próxima conta a vencer (com dias restantes)
  - Gráfico de rosca: distribuição do orçamento (renda × despesas fixas × variáveis × dívidas × disponível)
  - Indicador de progresso: "Você já quitou X% das suas dívidas"
  - Acesso rápido ao Plano de Ação IA
  - Responsivo (desktop e mobile)

---

#### Épico 7: Alertas e Notificações

**E7-US01** — Alertas de vencimento
- Como usuário, quero receber alertas quando contas ou parcelas estiverem vencendo
- **Critérios de aceite:**
  - Notificação in-app: 3 dias antes e no dia do vencimento
  - Email de lembrete (opt-in durante onboarding)
  - Lista de alertas ativos acessível no menu
  - Marcar alerta como "visto/resolvido"

---

### FASE 2 — Crescimento (pós-MVP)

| ID | Funcionalidade | Prioridade |
|----|---------------|------------|
| F2-01 | Histórico mensal detalhado com comparativo | Alta |
| F2-02 | Gráficos de evolução das dívidas ao longo do tempo | Alta |
| F2-03 | Metas de economia (ex: "guardar R$300/mês") | Média |
| F2-04 | Exportação do Plano de Ação em PDF | Alta (pago) |
| F2-05 | Multi-usuário familiar (convidar cônjuge/familiar) | Alta (pago) |
| F2-06 | Categorização automática de despesas | Média |
| F2-07 | Integração com Open Finance (saldo bancário automático) | Baixa |

---

### FASE 3 — Escala (futuro)

| ID | Funcionalidade |
|----|---------------|
| F3-01 | App mobile (PWA progressivo) |
| F3-02 | IA proativa (insights automáticos sem solicitação do usuário) |
| F3-03 | Comunidade / gamificação (conquistas ao quitar dívidas) |
| F3-04 | Integração com corretoras (sugestão de investimentos pós-dívidas) |

---

## 4. Requisitos Não-Funcionais

| Categoria | Requisito |
|-----------|-----------|
| **Performance** | Tempo de resposta da API ≤ 500ms (exceto chamadas IA) |
| **Performance IA** | Plano de Ação gerado em ≤ 15 segundos |
| **Disponibilidade** | Uptime ≥ 99.5% |
| **Segurança** | Dados financeiros criptografados em repouso e em trânsito (TLS 1.3) |
| **Segurança** | Autenticação com JWT + refresh token; senhas com bcrypt |
| **Segurança** | OWASP Top 10 aplicado no desenvolvimento |
| **Privacidade** | Conformidade com LGPD; dados não compartilhados com terceiros |
| **Escalabilidade** | Suportar 50.000 usuários simultâneos na Fase 2 |
| **Usabilidade** | Onboarding completo em ≤ 10 minutos |
| **Acessibilidade** | WCAG 2.1 nível AA |
| **Responsividade** | Funcional em mobile (≥ 320px) e desktop |
| **Internacionalização** | PT-BR como idioma principal; estrutura preparada para expansão |

---

## 5. Modelo de Dados — Entidades Principais

```
Usuário
  ├── Perfil (nome, email, plano)
  ├── Rendas [ ]
  ├── ContasFixas [ ]
  ├── ContasVariaveis [ ]
  ├── Dívidas [ ]
  │     └── Parcelas [ ]
  ├── PlanoDeAcao [ ] (histórico)
  └── Alertas [ ]
```

---

## 6. Integrações Externas

| Serviço | Finalidade | Fase |
|---------|-----------|------|
| GitHub Models API (LLM) | Geração do Plano de Ação IA | MVP |
| Serviço de email (ex: Resend) | Confirmação de cadastro, alertas, recuperação de senha | MVP |
| Gateway de pagamento (ex: Stripe / Pagar.me) | Cobrança do plano pago | MVP |

---

## 7. Fora do Escopo (MVP)

- Integração bancária automática (Open Finance)
- App mobile nativo
- Suporte a múltiplos idiomas
- Relatórios fiscais / imposto de renda
- Investimentos e corretoras
- Chat de suporte em tempo real

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Custo da API LLM ultrapassa orçamento | Média | Alto | Limitar chamadas no plano grátis; cache de respostas similares |
| Usuários não completam o onboarding | Alta | Alto | Onboarding simplificado; salvar progresso parcial |
| Dados financeiros sensíveis vazados | Baixa | Crítico | Criptografia, OWASP, auditoria de segurança pré-lançamento |
| Baixa taxa de conversão para plano pago | Média | Alto | Mostrar valor IA antes do paywall; trial de 7 dias do plano pago |
| Plano de ação IA com qualidade baixa | Média | Alto | Testes extensivos de prompt; feedback do usuário integrado |

---

## 9. Cronograma Estimado

| Fase | Duração estimada | Marcos |
|------|-----------------|--------|
| **Arquitetura e setup** | 1 semana | Repositório, infra, CI/CD configurados |
| **Épicos 1-3** (Auth, Renda, Contas) | 3 semanas | CRUD completo funcional |
| **Épico 4** (Dívidas) | 2 semanas | Gestão de dívidas completa |
| **Épico 5** (Plano IA) | 2 semanas | Integração LLM + plano gerado |
| **Épicos 6-7** (Dashboard, Alertas) | 2 semanas | MVP completo |
| **QA + ajustes** | 1 semana | Produto pronto para lançamento |
| **TOTAL MVP** | **~11 semanas** | |

---

## 10. Próximos Passos

1. ✅ Project Brief — concluído
2. ✅ PRD — **concluído**
3. ⏳ Especificações de UI/UX — **Sally (UX Expert)**
4. ⏳ Documento de Arquitetura Técnica — **Winston (Architect)**
5. ⏳ Backlog e Histórias de Usuário — **Sarah (PO)**
