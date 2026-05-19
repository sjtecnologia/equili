// ─── Contas Bancárias ─────────────────────────────────────────────────────────

export interface ContaBancaria {
  id: string
  nome: string
  banco: string
  tipo: string
  saldo_inicial: number
  cor: string
}

export interface CartaoCredito {
  id: string
  nome: string
  bandeira: string
  limite: number
  limite_disponivel?: number
  dia_fechamento: number
  dia_vencimento: number
  cor: string
}

// ─── Lançamentos ─────────────────────────────────────────────────────────────

export interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  data: string
  categoria: string | null
  origem?: string
  ofx_id?: string | null
}

export interface CartaoLancamento {
  id: string
  descricao: string
  valor: number
  tipo: 'compra' | 'pagamento'
  data: string
  categoria: string | null
}

export interface ContaLancamentosData {
  lancamentos: Lancamento[]
  saldo_inicial: number
  saldo_atual: number
  nome: string
  banco: string
  cor: string
  tipo: string
}

export interface CartaoLancamentosData {
  lancamentos: CartaoLancamento[]
  limite_total: number
  limite_disponivel: number
  limite_usado: number
  nome: string
  bandeira: string
  cor: string
  dia_fechamento: number
  dia_vencimento: number
}

// ─── Contas a Pagar / Receber ────────────────────────────────────────────────

export interface ContaAPagar {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_vencimento: string
  status: 'pendente' | 'pago' | 'vencido'
  tipo: string
  observacao: string | null
}

export interface ContaAReceber {
  id: string
  descricao: string
  origem: string
  valor: number
  data_prevista: string
  status: 'pendente' | 'recebido' | 'atrasado'
  tipo: string
  devedor: string | null
  observacao: string | null
}

// ─── Dívidas ─────────────────────────────────────────────────────────────────

export interface Divida {
  id: string
  descricao: string
  credor: string | null
  tipo: string
  valor_total: number
  valor_parcela: number
  parcelas_totais: number | null
  parcelas_restantes: number
  parcelas_atrasadas: number
  data_primeira_atrasada: string | null
  taxa_juros_mensal: number | null
  data_prox_vencimento: string
  data_inicio_contrato: string | null
  data_primeira_parcela: string | null
  quitada: boolean
}

export interface DividaPagamento {
  id: string
  data_referencia: string
  data_pagamento: string
  valor_pago: number
  valor_parcela_original: number
  observacao: string | null
}

export interface ContaFixaAtrasada {
  descricao: string
  categoria: string
  meses_atrasados: number
  total: number
  primeira_data: string
  ultima_data: string
}

// ─── Investimentos ───────────────────────────────────────────────────────────

export interface Investimento {
  id: string
  nome: string
  tipo: string
  instituicao: string | null
  quantidade: number | null
  preco_medio: number | null
  valor_investido: number
  valor_atual: number
  rentabilidade_pct: number
  data_aplicacao: string
  observacao: string | null
}

export interface CarteiraResumo {
  total_investido: number
  total_atual: number
  rentabilidade_pct: number
  por_tipo: Record<string, number>
}

// ─── Renda ───────────────────────────────────────────────────────────────────

export interface Renda {
  id: string
  descricao: string
  valor: number
  frequencia: string
  tipo: string
  ativo: boolean
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardResumo {
  renda_total: number
  total_despesas_fixas: number
  total_dividas: number
  total_dividas_ativas: number
  saldo_disponivel: number
  saldo_projetado_30d: number
  total_a_pagar_30d: number
  total_a_receber_30d: number
  proxima_conta_vencimento: string | null
  dias_proxima_conta: number | null
  plano_gerado: boolean
  parcelas_atrasadas_total: number
  valor_parcelas_atrasadas: number
  dividas_com_atraso: number
}

// ─── Plano de Ação ───────────────────────────────────────────────────────────

export interface OrdemQuitacao {
  ordem: number
  descricao: string
  data_quitacao_estimada: string
  motivo_prioridade: string
}

export interface PlanoConteudo {
  resumo_situacao: string
  estrategia: string
  justificativa_estrategia?: string
  valor_mensal_para_dividas?: number
  ordem_quitacao: OrdemQuitacao[]
  data_livre_prevista: string
  meses_ate_liberdade?: number
  sugestoes_economia: string[]
  mensagem_motivacional: string
  alerta_fluxo_caixa?: string | null
}

export interface PlanoAcao {
  id: string
  criado_em: string
  conteudo: PlanoConteudo
  estrategia: string | null
  data_livre_prevista: string | null
  feedback: number | null
}

// ─── Relatórios ───────────────────────────────────────────────────────────────

export interface FluxoMes {
  mes: number
  mes_nome: string
  ano: number
  entradas: number
  saidas: number
  saldo: number
}

export interface RelatorioDetalhado {
  contas_pagar: ContaAPagar[]
  contas_receber: ContaAReceber[]
  totais: {
    total_pagar: number
    total_receber: number
    saldo: number
  }
}

export interface ContaPagarDiaItem {
  id: string
  descricao: string
  categoria: string
  valor: number
  status: string
  tipo: string
  observacao: string | null
}

export interface ContasPagarDiaData {
  data: string
  total: number
  contas: ContaPagarDiaItem[]
}
