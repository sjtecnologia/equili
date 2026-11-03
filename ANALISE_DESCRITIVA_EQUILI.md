# Análise Descritiva do App Equili

> Documento gerado para auxiliar na criação de um plano de marketing e prospecção.

**Versão:** 1.0  
**Data:** 29/10/2026  
**Projeto:** Equili - Controle Financeiro Familiar com IA

---

## 1. Visão Geral

**Equili** é um aplicativo web/mobile (PWA + app nativo via Capacitor para Android/iOS) de controle financeiro familiar com IA, com foco principal em **ajudar famílias endividadas a saírem das dívidas por meio de um plano de ação claro e personalizado**.

O grande diferencial é que, ao invés de apenas registrar gastos (como a maioria dos apps financeiros), o Equili **diz exatamente o que fazer e quando a família estará livre das dívidas**.

**Slogan/Propósito:** *"Controle financeiro familiar com IA — liberdade financeira ao alcance de todos."*

---

## 2. Público-Alvo

| Persona | Perfil | Dor | Objetivo |
|---------|--------|-----|-----------|
| **Ana (Primária)** | 34 anos, casada, 2 filhos, renda familiar R$ 5.000/mês. Possui 4 dívidas ativas (cartão, empréstimo, financiamento, cheques). | Não sabe por onde começar, sente vergonha, tem conflitos familiares sobre dinheiro. | Ter um plano claro e sair das dívidas em ~2 anos. |
| **Carlos (Secundário)** | 42 anos, casado, sem dívidas, renda R$ 12.000/mês. | Perde o controle dos gastos variáveis, falta de visibilidade. | Manter equilíbrio e começar a investir. |

---

## 3. Proposta de Valor

- **Foco em saída de dívidas**: Diferente de apps que apenas categorizam gastos, o Equili gera um plano de ação ativo para quitação.
- **IA empática e prática**: Gera um plano personalizado em linguagem acessível, com estratégia priorizada, projeções e sugestões reais de corte de gastos.
- **Visão familiar**: Pensado para casais/famílias organizarem finanças juntos.
- **Tudo em um lugar**: Rendas, despesas fixas/variáveis, dívidas, contas a pagar/receber, cartões, investimentos, metas, listas de compra.
- **Projeção concreta**: Mostra "quando ficaremos livres das dívidas" com datas estimadas por dívida e data para estar 100% livre.

---

## 4. Funcionalidades Principais

### 4.1 Autenticação e Onboarding
- Cadastro com email/senha (com validação robusta)
- Login com Google e Apple (via Capacitor native plugins)
- Biometria/Face ID/Touch ID para sessões
- Verificação de email
- Recuperação de senha
- Onboarding guiado em 4 etapas (perfil familiar, renda, contas fixas, dívidas)
- Geração automática do primeiro Plano de Ação IA ao final

### 4.2 Gestão Financeira Básica
| Módulo | Funcionalidades |
|---------|-----------------|
| **Rendas** | Múltiplas fontes (salário, freela, aluguel, outros), frequência (mensal/quinzenal/semanal), cálculo automático da renda total |
| **Contas Fixas** | Cadastro com categoria, valor, dia de vencimento, alertas automáticos 3 dias antes do vencimento |
| **Contas Variáveis** | Gastos por categoria, possibilidade de lançamentos avulsos |
| **Contas a Pagar/Receber** | Controle completo de compromissos futuros |
| **Contas Bancárias** | Múltiplas contas, saldos |
| **Cartões de Crédito** | Gestão de cartões, faturas, lançamentos por cartão |
| **Categorias** | Personalização de categorias |

### 4.3 Gestão de Dívidas (Core)
- Cadastro completo: tipo (cartão parcelado, empréstimo pessoal, financiamento, cheque pré-datado, outro), credor, valor total, valor da parcela, parcelas restantes/totais, juros, datas
- Limite de 3 dívidas no plano gratuito (com banner para upgrade)
- Dívidas ilimitadas no plano pago
- Marcação de parcelas pagas com recálculo automático
- Celebração visual ao quitar dívida completamente
- Histórico de pagamentos por dívida
- Priorização baseada no Plano de Ação IA

### 4.4 Plano de Ação com IA (Diferencial)
- **Análise inteligente**: Considera renda disponível (renda - despesas fixas - variáveis), dívidas com juros, perfil familiar
- **Estratégias**: Recomendação entre *Avalanche* (maior juros primeiro) ou *Bola de Neve* (menor valor primeiro) com justificativa
- **Saída completa**: Resumo empático, ordem priorizada, valor sugerido por mês, projeção por dívida e data para estar 100% livre de dívidas
- **Sugestões práticas**: 3 sugestões de corte de gastos personalizadas
- **Histórico**: Últimos 3 planos gerados
- **Feedback**: Avaliação (👍/👎) + comentário para melhoria
- **Limites**: Grátis tem limite mensal de gerações; plano pago ilimitado
- **Performance**: Gerado em até 15 segundos

### 4.5 Dashboard e Insights
- Cards: Renda total, despesas, dívidas, saldo disponível, próxima conta a vencer
- Gráfico de rosca com distribuição do orçamento
- Progresso: "% das dívidas já quitadas"
- Acesso rápido ao Plano de Ação IA
- Visão consolidada da saúde financeira familiar

### 4.6 Funcionalidades Complementares
| Módulo | Descrição |
|---------|-----------|
| **Metas** | Criação e acompanhamento de metas de economia |
| **Investimentos** | Controle básico de investimentos |
| **Listas de Compra** | Listas compartilháveis |
| **Notas Fiscais** | Cadastro de NF recebidas |
| **Família** | Multi-usuário familiar (convidar cônjuge/membros) - recurso premium |
| **Chat com IA** | Assistente financeiro conversacional |
| **Comando por Voz** | Funcionalidade de voz para comandos financeiros |
| **Alertas/Notificações** | Vencimentos (3 dias antes e no dia), notificações push |
| **Relatórios** | Exportação em PDF (recurso pago) |
| **Planos/Assinaturas** | Gestão de plano gratuito/pago |

---

## 5. Modelo de Negócio (Freemium)

| Recurso | **Grátis** | **Pago** |
|---------|-----------|---------|
| **Dívidas cadastradas** | Até 3 | Ilimitadas |
| **Rendas, contas, despesas** | Ilimitado | Ilimitado |
| **Plano de Ação IA** | Limitado por mês | Ilimitado |
| **Dashboard e gráficos** | ✅ | ✅ |
| **Alertas de vencimento** | ✅ | ✅ |
| **Exportação PDF do Plano** | ❌ | ✅ |
| **Multi-usuário familiar** | ❌ | ✅ |
| **Histórico avançado** | ❌ | ✅ |

O monetização acontece via conversão do usuário gratuito para plano pago, aproveitando o momento em que ele vê valor real no Plano de Ação IA (paywall estratégico).

---

## 6. Stack Tecnológica

| Camada | Tecnologias | Observações |
|--------|-------------|-------------|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic | API REST bem estruturada, com versionamento (/api/v1), middlewares de segurança, rate limiting |
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS 3/4, TanStack Query, Zustand, React Hook Form + Zod | SPA moderna, responsiva, PWA configurado |
| **Mobile Nativo** | Capacitor 8 (Android/iOS) | Plugins para biometria, Google/Apple Sign-In, Splash Screen, Status Bar |
| **Banco de Dados** | PostgreSQL 16 | Relacional, com UUIDs, JSONB para dados do plano IA, migrations com Alembic |
| **IA/LLM** | OpenRouter (modelos `:free`) | Geração do Plano de Ação, Chat IA, Comando por Voz |
| **Autenticação** | JWT (access em memória + refresh em httpOnly cookie), OAuth Google/Apple, Biometria | Segurança robusta com CSRF protection, sessões |
| **Infra/Monitoramento** | Redis (rate limiting distribuído opcional), Rastro (error tracking) | Observabilidade e proteção |
| **Email** | Resend (configurável) | Confirmação, recuperação de senha, alertas |
| **Testes** | pytest (backend), vitest (frontend) | Cobertura de testes presente |

---

## 7. Diferenciais Competitivos

| Concorrente | Abordagem | Diferencial do Equili |
|-------------|-----------|------------------------|
| **Organizze, Mobills, Minhas Economias** | Foco em registro/categorização de gastos (passivo) | **Ativo**: Gera plano de ação concreto com "o que fazer" e cronograma para sair das dívidas |
| **Guiabolso** | Agregação bancária/Open Finance | **Foco em solução, não só visualização**: IA cria estratégia personalizada (avalanche/bola de neve) com projeções reais |
| **Apps genéricos de orçamento** | Orçamento geral | **Foco em famílias endividadas**: Linguagem empática, onboarding focado em dívidas, celebração de conquistas, visão familiar |

**Diferencial chave:** *"Não é um organizador, é um guia para sair das dívidas."*

---

## 8. Dados para Marketing/Prospecção

### 8.1 Proposta de Mensagem
- **Headline:** "Sair das dívidas não precisa ser um mistério. O Equili mostra o caminho."
- **Subheadline:** "Planejamento financeiro familiar com IA que cria seu plano de ação personalizado para quitar dívidas."
- **CTA:** "Crie seu plano gratuito" / "Descubra quando você ficará livre das dívidas"

### 8.2 Canais Potenciais
| Canal | Razão | Tipo |
|-------|-------|------|
| **Instagram/Tiktok/YT Shorts** | Público endividado consome conteúdo financeiro (dívidas, planejamento) | Conteúdo orgânico (educativo: "Por onde começar a quitar dívidas?") |
| **Google Ads (Busca)** | Intenção alta: "sair das dívidas", "organizar dívidas", "planilha dívidas" | Pago (conversão) |
| **Facebook/Meta** | Ótimo para alcançar famílias (25-45 anos) | Pago + Remarketing |
| **SEO (Blog)** | Long tail: "método avalanche vs bola de neve", "como quitar dívidas com pouco dinheiro" | Orgânico a longo prazo |
| **Influenciadores financeiros** | Credibilidade com público endividado | Parcerias |
| **Comunidades (grupos família/orçamento)** | Alcance orgânico com validação | Conteúdo genuíno |

### 8.3 Palavras-Chave Sugeridas
**Alta intenção:** `sair das dívidas`, `quitar dívidas`, `plano para sair das dívidas`, `organizar dívidas`

**Problema/solução:** `como sair das dívidas com pouco dinheiro`, `método bola de neve dívidas`, `priorizar dívidas juros`

**Long tail:** `calcular quando saio das dívidas`, `plano de quitação de dívidas`, `controle financeiro familiar dívidas`

### 8.4 Métricas de Sucesso (do PRD)
| Métrica | Meta MVP (6 meses) |
|---------|-------------------|
| Usuários cadastrados | 10.000 |
| Conversão gratuito → pago | ≥ 5% |
| Retenção mensal (D30) | ≥ 40% |
| NPS | ≥ 50 |
| Planos de ação gerados | ≥ 30.000 |
| Tempo médio de onboarding | ≤ 10 min |

### 8.5 Pontos para Destaque na Prospecção
- **Foco resolutivo**: Não "controle gastos", mas "saia das dívidas"
- **IA prática**: Resultado tangível em minutos (plano completo gerado)
- **Gratuito para começar**: Baixa barreira de entrada
- **Familiar**: Diferencia de apps individuais
- **Empático**: Linguagem sem julgamentos, pensada para quem tem vergonha
- **Brasileiro**: Voltado ao contexto brasileiro (cartão parcelado, cheque pré-datado, real)

---

## 9. Estado Atual do Projeto

- **Versão Frontend:** 1.0.2
- **Status:** Em desenvolvimento ativo (múltiplos commits recentes focados em auth, biometria, deploy)
- **Produção-ready features:** Maioria dos épicos do MVP já implementados (auth, rendas, dívidas, plano IA, dashboard, alertas, assinaturas)
- **Mobile:** Preparado para Android/iOS via Capacitor
- **PWA:** Configurado com Vite PWA

---

## 10. Informações para o Agente Claude Criar o Plano de Marketing

Ao criar o plano, sugiro focar nestes pontos-chave:

1. **Posicionamento:** "O guia com IA para famílias brasileiras saírem das dívidas" - mais resolutivo que "controle financeiro"
2. **Persona principal:** Famílias endividadas classe média/baixa-média com 2-4 dívidas, buscando direção
3. **Hook forte:** "Descubra em 2 minutos por onde começar a quitar suas dívidas" (leva ao onboarding + plano IA)
4. **Monetização clara:** Conversão via valor do plano IA (free tem limite de dívidas/gerações)
5. **Conteúdo educativo:** Criar autoridade resolvendo dúvidas reais sobre endividamento
6. **Foco em Brasil:** Mercado gigante com alta taxa de endividamento familiar
7. **Diferenciação:** Plano de ação gerado por IA vs planilhas estáticas
8. **Métricas acionáveis:** Focar em CAC vs LTV desde o início, com conversão gratuito→pago como north star

**Arquivos relevantes para referência:** `docs/prd.md`, `docs/project-brief.md`, `README.md`, `frontend/package.json`, estrutura de rotas e modelos backend.
