# Project Brief — Equili

**Data:** 24 de março de 2026
**Status:** Aprovado pelo cliente
**Próximo artefato:** PRD (Product Requirements Document)

---

## Visão Geral

**Equili** é um sistema web de controle financeiro familiar com IA, focado em ajudar famílias endividadas a sair das dívidas e famílias equilibradas a manter sua saúde financeira.

---

## Problema que Resolve

Famílias endividadas não têm clareza sobre sua situação financeira real nem um caminho concreto para sair das dívidas — gerando stress, conflitos familiares e perpetuando o ciclo de endividamento.

---

## Público-Alvo

| Segmento | Descrição |
|----------|-----------|
| **Primário** | Famílias endividadas (cartão parcelado, empréstimos, cheques pré-datados) |
| **Secundário** | Famílias que querem manter o equilíbrio financeiro atual |

---

## Funcionalidades Core (MVP)

### Entradas
- **Renda**: Cadastro de rendimentos mensais (salários, freelas, aluguéis, etc.)
- **Contas Fixas**: Aluguel, luz, água, internet, plano de saúde, etc.
- **Contas Variáveis**: Mercado, combustível, lazer, etc.
- **Dívidas**: Cartão parcelado, empréstimos pessoais/bancários, cheques pré-datados, financiamentos

### Saídas / Funcionalidades
| Módulo | Descrição |
|--------|-----------|
| **Plano de Ação IA** | LLM gera plano personalizado de quitação de dívidas |
| **Dashboard** | Gráficos de situação atual e evolução financeira |
| **Projeção** | Linha do tempo — quando a família ficará no azul |
| **Metas** | Definir e acompanhar metas de economia mensal |
| **Alertas** | Notificações de vencimento de contas e dívidas |
| **Histórico** | Registro e comparativo mensal de progresso |
| **Relatórios** | Exportação em PDF (plano pago) |
| **Multi-usuário** | Membros da família no mesmo perfil (plano pago) |

---

## IA — Integração LLM

- **Modelo**: GitHub Models (API compatível com OpenAI)
- **Função**: Analisar dados financeiros e gerar:
  - Plano de ação priorizado (método avalanche / bola de neve)
  - Conselhos personalizados em linguagem natural e empática
  - Projeção de saída da dívida com datas estimadas
  - Sugestões de corte de gastos baseadas no perfil

---

## Modelo de Negócio — Freemium

| Recurso | Grátis | Pago |
|---------|--------|------|
| Dívidas cadastradas | Até 3 | Ilimitado |
| Contas e rendimentos | Ilimitado | Ilimitado |
| Plano de Ação IA | Limitado | Ilimitado |
| Dashboard e gráficos | ✅ | ✅ |
| Alertas de vencimento | ✅ | ✅ |
| Exportação PDF | ❌ | ✅ |
| Multi-usuário familiar | ❌ | ✅ |
| Histórico avançado | ❌ | ✅ |

---

## Stack Tecnológico Definido

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | Python + FastAPI |
| **Frontend** | React + Vite + Tailwind CSS |
| **IA** | GitHub Models (LLM via API) |
| **Banco de dados** | A definir na arquitetura |
| **Deploy** | A definir na arquitetura |

---

## Diferencial Competitivo

Enquanto concorrentes (Organizze, Mobills, GuiaBolso) atuam como **registradores financeiros passivos**, o Equili entrega um **plano de ação ativo e personalizado via IA** — dizendo à família exatamente *o que fazer* e *quando estarão livres das dívidas*.

---

## Próximos Passos

1. ✅ Project Brief — **concluído**
2. ⏳ PRD (Product Requirements Document) — **John (PM)**
3. ⏳ Especificações de UI/UX — **Sally (UX Expert)**
4. ⏳ Documento de Arquitetura — **Winston (Architect)**
5. ⏳ Backlog e Histórias — **Sarah (PO)**
