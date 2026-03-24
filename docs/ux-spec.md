# Especificação de UI/UX — Equili

**Versão:** 1.0
**Data:** 24 de março de 2026
**UX Expert:** Sally (BMad UX Agent)
**Status:** Aprovado para Arquitetura

---

## 1. Princípios de Design

O Equili atende famílias que carregam o peso emocional das dívidas. O design deve:

1. **Acolher, não julgar** — Nunca usar linguagem alarmista. "Dívida" vira "compromisso financeiro" onde possível.
2. **Clareza acima de tudo** — Dados financeiros complexos devem parecer simples.
3. **Celebrar progresso** — Cada pequena conquista (parcela paga, meta atingida) merece reconhecimento.
4. **Reduzir ansiedade** — Cores, espaçamento e microtextos devem transmitir calma e controle.
5. **Mobile-first** — A persona primária (Ana) usa principalmente smartphone.

---

## 2. Identidade Visual

### 2.1 Paleta de Cores

| Token | Hex | Uso |
|-------|-----|-----|
| `primary-500` | `#2E7D5E` | Verde-floresta: cor principal, CTAs, progresso |
| `primary-400` | `#48A07A` | Hover states, destaques positivos |
| `primary-100` | `#E8F5EF` | Backgrounds suaves, cards informativos |
| `accent-500` | `#E8A838` | Âmbar: alertas, destaques neutros, datas |
| `accent-100` | `#FEF3DC` | Background de alertas |
| `danger-500` | `#C0392B` | Saldo negativo, dívidas críticas |
| `danger-100` | `#FDEDEC` | Background de estados de erro |
| `neutral-900` | `#1A1A2E` | Texto principal |
| `neutral-600` | `#6B7280` | Texto secundário / labels |
| `neutral-200` | `#F3F4F6` | Background de páginas |
| `neutral-100` | `#FFFFFF` | Cards, modais |
| `success-500` | `#27AE60` | Dívida quitada, meta atingida |

**Diretrizes:**
- Fundo das páginas: `neutral-200` (cinza claríssimo, não branco puro — reduz fadiga visual)
- Cards: `neutral-100` com sombra sutil `shadow-sm`
- Nunca usar vermelho como cor principal da interface — apenas para estados críticos

### 2.2 Tipografia

| Papel | Família | Peso | Tamanho |
|-------|---------|------|---------|
| Títulos (H1) | Inter | 700 (Bold) | 28px / 1.75rem |
| Subtítulos (H2) | Inter | 600 (SemiBold) | 22px / 1.375rem |
| H3 | Inter | 600 | 18px / 1.125rem |
| Corpo | Inter | 400 (Regular) | 16px / 1rem |
| Corpo pequeno | Inter | 400 | 14px / 0.875rem |
| Labels / Captions | Inter | 500 (Medium) | 12px / 0.75rem |
| Valores monetários | Inter | 700 | 24px / 1.5rem |

- **Line-height padrão:** 1.6 (aumenta legibilidade para textos financeiros)
- **Fonte:** Inter (Google Fonts) — humanista, legível, amplamente suportada

### 2.3 Espaçamento (escala 4px)

```
4px   = espaço mínimo (xs)
8px   = espaço pequeno (sm)
16px  = espaço médio (md) — padrão entre elementos
24px  = espaço médio-grande (lg)
32px  = espaço grande (xl)
48px  = espaço extra-grande (2xl)
64px  = seções de página (3xl)
```

### 2.4 Bordas e Sombras

```css
/* Cards padrão */
border-radius: 12px;
box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);

/* Cards em hover */
box-shadow: 0 4px 12px rgba(0,0,0,0.10);

/* Modais */
border-radius: 16px;
box-shadow: 0 20px 40px rgba(0,0,0,0.15);
```

### 2.5 Ícones

- Biblioteca: **Lucide React** (linha, estilo moderno e acolhedor)
- Tamanho padrão: 20px
- Cor: herdar do contexto (não usar ícones coloridos isolados)

---

## 3. Componentes de Design System

### 3.1 Botões

```
Primary Button
  bg: primary-500 | hover: primary-400
  text: white | font-weight: 600
  padding: 12px 24px | border-radius: 8px
  Uso: ação principal da página (máx. 1 por tela)

Secondary Button
  bg: primary-100 | hover: primary-500/10
  text: primary-500 | border: 1px solid primary-200
  Uso: ações secundárias

Ghost Button
  bg: transparent | hover: neutral-200
  text: neutral-600
  Uso: ações terciárias, cancelar

Danger Button
  bg: danger-500 | hover: danger-600
  text: white
  Uso: exclusão, ações destrutivas (sempre com modal de confirmação)
```

### 3.2 Cards

```
Card Base
  bg: white | border-radius: 12px
  padding: 24px | shadow: shadow-sm
  
Card de Métrica (Dashboard)
  Ícone (24px) + Label (12px neutral-600) + Valor (24px bold)
  Indicador colorido sutil na borda esquerda (3px)

Card de Dívida
  Nome da dívida (bold) + Credor (neutral-600)
  Barra de progresso de quitação (primary-500)
  Valor restante (bold danger-500) + Próxima parcela (accent-500)
  Badge de prioridade (baseado no plano IA)
```

### 3.3 Formulários

```
Input Field
  Label acima do campo (não placeholder como label)
  border: 1px solid neutral-300 | border-radius: 8px
  padding: 12px 16px | focus: border primary-500 + ring
  Mensagem de erro abaixo em danger-500 (12px)
  Helper text abaixo em neutral-600 (12px)

Select / Dropdown
  Mesmo estilo do Input Field
  Ícone chevron-down à direita

Currency Input
  Prefixo "R$" fixo à esquerda
  Formatação automática de máscara monetária
  Alinhamento de valor à direita
```

### 3.4 Barra de Progresso

```
Track: neutral-200 | border-radius: full | height: 8px
Fill: primary-500 com gradiente sutil
Animação: transition 600ms ease-out ao mudar valor
```

### 3.5 Feedback States

```
Toast de sucesso: bg success-500, ícone check, 3s auto-dismiss
Toast de erro: bg danger-500, ícone x-circle, persistente até fechar
Toast de alerta: bg accent-500, ícone alert-triangle
Loading skeleton: pulse animation em neutral-200
Empty state: ilustração + título + subtítulo + CTA
```

---

## 4. Navegação e Layout

### 4.1 Estrutura de Layout (Desktop)

```
┌─────────────────────────────────────────┐
│  Sidebar (240px fixo)  │  Main Content  │
│                        │                │
│  Logo Equili           │  Header        │
│  ─────────────────     │  ─────────── │
│  Dashboard             │               │
│  Renda                 │  [Conteúdo     │
│  Contas                │   da página]  │
│  Dívidas               │               │
│  Plano de Ação ★      │               │
│  Alertas 🔴           │               │
│  ─────────────────     │               │
│  Configurações         │               │
│  Plano: Grátis [+]     │               │
└─────────────────────────────────────────┘
```

### 4.2 Estrutura de Layout (Mobile)

```
┌──────────────────────┐
│  Header (logo + sino)│
├──────────────────────┤
│                      │
│  [Conteúdo           │
│   da página]         │
│                      │
├──────────────────────┤
│  Bottom Navigation   │
│  🏠 💰 📋 ⭐ 🔔   │
└──────────────────────┘
```

### 4.3 Itens de Navegação

| Ícone | Label | Rota |
|-------|-------|------|
| `home` | Dashboard | `/dashboard` |
| `wallet` | Renda | `/renda` |
| `receipt` | Contas | `/contas` |
| `credit-card` | Dívidas | `/dividas` |
| `sparkles` | Plano de Ação | `/plano-de-acao` |
| `bell` | Alertas | `/alertas` |
| `settings` | Configurações | `/configuracoes` |

---

## 5. Fluxos de Tela

### 5.1 Fluxo de Autenticação

```
Landing Page
  └─► Cadastro
        └─► Verificação de email
              └─► Onboarding (4 etapas)
                    └─► Dashboard

  └─► Login
        └─► Dashboard
        └─► Esqueci a senha
              └─► Email de redefinição
                    └─► Nova senha
                          └─► Login
```

### 5.2 Fluxo de Onboarding

```
Etapa 1: Perfil Familiar
  - Nome da família (ex: "Família Silva")
  - Número de adultos
  - Número de dependentes
  
Etapa 2: Renda Mensal
  - Adicionar fontes de renda
  - Total calculado em tempo real
  
Etapa 3: Contas Fixas
  - Adicionar contas fixas principais
  - Opção de pular

Etapa 4: Dívidas
  - Adicionar dívidas
  - Limite de 3 para plano grátis (banner visível)
  
Conclusão: "Gerando seu primeiro Plano de Ação..."
  └─► Dashboard com plano gerado
```

---

## 6. Especificação de Telas (MVP)

### 6.1 Landing Page (não autenticado)

**Seções:**
1. **Hero**: Tagline "Saia das dívidas com um plano feito para você", CTA "Começar grátis", imagem de família tranquila
2. **Como funciona**: 3 passos (Cadastre suas finanças → IA analisa tudo → Receba seu plano)
3. **Benefícios**: Cards com ícones (Plano personalizado / Sem julgamentos / Grátis para começar)
4. **Social proof**: Depoimentos (post-lançamento)
5. **Pricing**: Tabela grátis vs. pago
6. **CTA final**: "Sua família merece equilíbrio. Comece hoje."
7. **Footer**: Links legais, redes sociais

---

### 6.2 Dashboard

**Layout em grid responsivo:**

```
┌─────────┬─────────┬─────────┬─────────┐
│  Renda  │Despesas │ Dívidas │  Saldo  │  ← Cards de métrica
│  R$X    │  R$X    │  R$X    │  R$X    │
└─────────┴─────────┴─────────┴─────────┘
┌─────────────────────┬───────────────────┐
│ Gráfico Rosca       │ Próximos           │
│ (distribuição do    │ vencimentos        │
│  orçamento)         │ (lista 3 itens)    │
└─────────────────────┴───────────────────┘
┌─────────────────────────────────────────┐
│ Banner: Plano de Ação IA                │
│ "Você está a X meses de quitar tudo"   │
│ [Ver meu plano]                         │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Progresso das Dívidas (top 3)           │
│ [barra de progresso por dívida]         │
└─────────────────────────────────────────┘
```

**Microcopy importante:**
- Saldo positivo: "Você tem R$ X disponíveis este mês 🎉"
- Saldo negativo: "Atenção: suas despesas superam sua renda em R$ X. O Equili vai te ajudar."
- Sem dados ainda: "Comece cadastrando sua renda para ver seu painel completo"

---

### 6.3 Tela de Dívidas

**Componentes:**
- Header com total geral de dívidas
- Filtros: Todas / Por vencer / Maior juros
- Lista de cards de dívida (ordenada pela prioridade do plano IA)
- FAB (Floating Action Button) "+" para adicionar dívida
- Banner de limite (plano grátis): "Você usou 3/3 dívidas do plano grátis. [Fazer upgrade →]"

**Card de Dívida:**
```
┌──────────────────────────────────────┐
│ 🏦 Empréstimo Banco X    [PRIORIDADE 1]│
│    Banco X                             │
│                                        │
│    ████████░░░░░░░  52% quitado        │
│                                        │
│    Restam: R$ 4.800     Juros: 3,5%/mês│
│    Próx. parcela: R$ 450  em 5 dias   │
│                                        │
│    [Marcar parcela paga]  [Editar]    │
└──────────────────────────────────────┘
```

---

### 6.4 Tela de Plano de Ação IA ⭐

**É a tela mais importante do produto. Deve causar impacto positivo.**

```
┌──────────────────────────────────────────┐
│  ✨ Seu Plano de Ação Personalizado      │
│  Gerado em 24/03/2026                    │
├──────────────────────────────────────────┤
│                                          │
│  📊 Sua Situação Atual                   │
│  [Resumo empático gerado pela IA]        │
│                                          │
├──────────────────────────────────────────┤
│  🎯 Estratégia Recomendada               │
│  Método Avalanche (maior juros primeiro) │
│  [Explicação em linguagem simples]       │
│                                          │
├──────────────────────────────────────────┤
│  📋 Ordem de Quitação                    │
│                                          │
│  1º Empréstimo Banco X — quitado em Mar/27│
│  2º Cartão Itaú — quitado em Jun/27      │
│  3º Cheque Loja A — quitado em Ago/27    │
│                                          │
├──────────────────────────────────────────┤
│  🏁 Você estará livre de dívidas em:     │
│                                          │
│         AGOSTO DE 2027                   │
│         (17 meses a partir de hoje)      │
│                                          │
├──────────────────────────────────────────┤
│  💡 3 Sugestões de Economia              │
│  · Reduzir gastos com [categoria X]      │
│  · [Sugestão 2]                          │
│  · [Sugestão 3]                          │
│                                          │
├──────────────────────────────────────────┤
│  [👍 Útil]  [👎 Melhorar]  [📄 Exportar PDF (pago)]│
│                                          │
│  [🔄 Gerar novo plano] (3/3 restantes)  │
└──────────────────────────────────────────┘
```

**Loading state (durante geração do plano):**
```
┌──────────────────────────────────────┐
│                                      │
│    ✨ A IA está analisando           │
│       sua situação...                │
│                                      │
│    [●●●●●○○○○○]  50%                 │
│                                      │
│    "Cada passo conta. Você já        │
│     está fazendo a parte mais        │
│     difícil: começar."               │
│                                      │
└──────────────────────────────────────┘
```
(Mensagens motivacionais rotativas durante o loading)

---

### 6.5 Tela de Alertas

**Lista de alertas ordenados por urgência:**
```
🔴 HOJE     Parcela Cartão Itaú — R$ 320,00
🟡 3 dias   Conta de luz — R$ 180,00
🟡 5 dias   Parcela Empréstimo — R$ 450,00
⚪ 12 dias  Aluguel — R$ 1.200,00
```

---

## 7. Tom de Voz e Microcopy

### 7.1 Princípios

| ❌ Evitar | ✅ Usar |
|-----------|---------|
| "Você está no vermelho" | "Vamos ajustar seu orçamento" |
| "Dívida crítica" | "Compromisso prioritário" |
| "Erro: dados inválidos" | "Hmm, algo não parece certo. Pode verificar?" |
| "Você atingiu o limite" | "Você usou todas as vagas do plano grátis — que tal desbloquear mais?" |
| "Pagamento recusado" | "Não conseguimos processar. Tente outro cartão." |

### 7.2 Mensagens de Onboarding

- **Início:** "Olá! Vamos entender sua situação para criar seu plano. Leva menos de 10 minutos."
- **Etapa de dívidas:** "Sabemos que não é fácil listar as dívidas. Mas esse é o primeiro passo para mudar tudo."
- **Conclusão:** "Incrível! Agora a IA vai trabalhar para você. 🎉"

### 7.3 Empty States

- **Sem dívidas:** "Sem dívidas cadastradas. Se você tiver alguma, adicione aqui — o Equili vai te ajudar a quitá-las!"
- **Sem renda:** "Cadastre sua renda para que o Equili possa montar seu plano."
- **Plano não gerado:** "Adicione pelo menos 1 dívida e sua renda para gerar seu plano de ação."

---

## 8. Acessibilidade

- **Contraste mínimo:** 4.5:1 para texto normal, 3:1 para texto grande (WCAG AA)
- **Foco visível:** Outline de 2px `primary-500` em todos os elementos interativos
- **Labels obrigatórios:** Todo campo de formulário com `<label>` associado
- **Alt text:** Todas as imagens e ícones semânticos
- **ARIA:** `role`, `aria-label`, `aria-describedby` onde necessário
- **Não depender só de cor:** sempre acompanhar com ícone ou texto (ex: não só verde/vermelho)

---

## 9. Responsividade — Breakpoints

```css
sm:  640px   /* Mobile landscape */
md:  768px   /* Tablet */
lg:  1024px  /* Desktop pequeno */
xl:  1280px  /* Desktop padrão */
2xl: 1536px  /* Desktop grande */
```

| Componente | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| Navegação | Bottom bar | Sidebar colapsável | Sidebar fixa |
| Cards de métrica | 1 coluna | 2 colunas | 4 colunas |
| Gráfico rosca | Oculto | Visível | Visível |
| Tabelas | Cards verticais | Tabela compacta | Tabela completa |

---

## 10. Animações e Transições

```css
/* Transição padrão de elementos */
transition: all 150ms ease-in-out;

/* Entrada de cards/modais */
animation: fadeInUp 200ms ease-out;

/* Barras de progresso */
transition: width 600ms ease-out;

/* Toast notifications */
animation: slideInRight 200ms ease-out;

/* Celebração ao quitar dívida */
animation: confetti 1s ease-out; /* usando canvas-confetti */
```

**Regra:** Nunca usar animações superiores a 300ms em interações frequentes (formulários, cliques). Animações longas apenas em momentos de celebração.

---

## 11. Prompt para Geração de UI (v0 / Lovable)

Caso seja necessário prototipar rapidamente com ferramentas de IA:

```
Create a financial dashboard for "Equili", a family debt management app.
Design language: warm, human, and approachable (not corporate/banking).
Color palette: forest green (#2E7D5E) as primary, amber (#E8A838) for alerts,
clean white cards on light gray background (#F3F4F6).
Typography: Inter font, generous line-height.
Components needed:
1. Sidebar navigation with icons
2. Dashboard with 4 metric cards (income, expenses, debts, available balance)
3. Donut chart showing budget distribution
4. Debt progress cards with priority badges
5. AI Action Plan section with empathetic copy
Style: rounded corners (12px), soft shadows, mobile-responsive.
Tailwind CSS. React components.
```

---

## 12. Próximos Passos

1. ✅ Project Brief — concluído
2. ✅ PRD — concluído
3. ✅ Especificação UI/UX — **concluído**
4. ⏳ Documento de Arquitetura Técnica — **Winston (Architect)**
5. ⏳ Backlog e Histórias de Usuário — **Sarah (PO)**
