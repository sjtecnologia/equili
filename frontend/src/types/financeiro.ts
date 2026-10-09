// ─── Union Types (domínio fixo) ───────────────────────────────────────────────

export type TipoConta = 'corrente' | 'poupanca' | 'investimento' | 'digital'
export type BandeiraCartao = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outro'
export type CategoriaGasto = 'moradia' | 'transporte' | 'saude' | 'educacao' | 'alimentacao' | 'lazer' | 'outro'
export type OrigemRenda = 'salario' | 'freela' | 'venda' | 'emprestimo' | 'outro'
export type ModalidadeConta = 'avulsa' | 'recorrente' | 'parcelada'
export type StatusContaPagar = 'pendente' | 'pago' | 'vencido' | 'parcial'
export type StatusContaReceber = 'pendente' | 'recebido' | 'atrasado' | 'parcial'
export type FrequenciaRenda = 'mensal' | 'quinzenal' | 'semanal'
export type TipoRenda = 'salario' | 'freela' | 'aluguel' | 'outro'
export type TipoInvestimento = 'acoes' | 'fii' | 'renda_fixa' | 'criptomoeda' | 'tesouro' | 'outro'
export type TipoDivida = 'emprestimo' | 'financiamento' | 'cartao_parcelado' | 'cheque_pre' | 'outro'
export type TipoContaPagar = 'avulsa' | 'fixa' | 'variavel'
export type TipoContaReceber = 'avulsa' | 'recorrente' | 'parcelada'

// ─── Contas Bancárias ─────────────────────────────────────────────────────────

export interface ContaBancaria {
  id: string
  nome: string
  banco: string
  tipo: TipoConta
  saldo_inicial: number
  saldo_atual?: number
  cor: string
}

export interface CartaoCredito {
  id: string
  nome: string
  bandeira: BandeiraCartao
  limite: number
  limite_atual: number
  limite_utilizado?: number
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
  tipo: TipoConta
}

export interface CartaoLancamentosData {
  lancamentos: CartaoLancamento[]
  limite_total: number
  limite_atual: number
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
  valor_baixado: number
  id: string
  descricao: string
  categoria: CategoriaGasto
  valor: number
  data_vencimento: string
  status: StatusContaPagar
  tipo: TipoContaPagar
  observacao: string | null
  conta_id?: string | null
  cartao_id?: string | null
}

export interface ContaAReceber {
  valor_baixado: number
  id: string
  descricao: string
  origem: OrigemRenda
  valor: number
  data_prevista: string
  status: StatusContaReceber
  tipo: TipoContaReceber
  devedor: string | null
  observacao: string | null
  data_recebimento?: string | null
  meio_recebimento?: 'conta' | 'dinheiro' | null
  conta_id?: string | null
}

// ─── Dívidas ─────────────────────────────────────────────────────────────────

export interface Divida {
  id: string
  descricao: string
  credor: string | null
  tipo: TipoDivida
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
  parcelas: ParcelaDivida[]
  parcelas_pagas: number
}

export interface ParcelaDivida {
  numero: number
  vencimento: string
  status: 'paga' | 'vencida' | 'a_vencer'
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
  categoria: CategoriaGasto
  meses_atrasados: number
  total: number
  primeira_data: string
  ultima_data: string
}

// ─── Investimentos ───────────────────────────────────────────────────────────

export interface Investimento {
  id: string
  nome: string
  tipo: TipoInvestimento
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
  frequencia: FrequenciaRenda
  tipo: TipoRenda
  ativo: boolean
}

// ─── Metas financeiras ───────────────────────────────────────────────────────

export interface Meta {
  id: string
  titulo: string
  descricao: string | null
  categoria: string | null
  valor_alvo: number
  valor_atual: number
  prazo: string | null
  concluida: boolean
  progresso: number
  percentual: number
  restante: number
  criado_em: string | null
}

export interface MetasResponse {
  metas: Meta[]
  total: number
  ativas: number
}

export interface MetaPayload {
  titulo: string
  descricao?: string | null
  categoria?: string | null
  valor_alvo: number
  valor_atual?: number
  prazo?: string | null
}

// ─── Administração ───────────────────────────────────────────────────────────

export interface UsuarioAdmin {
  id: string
  nome: string
  email: string
  plano: string
  is_admin: boolean
  ativo: boolean
  criado_em: string
}

export interface UsuarioAtivoUpdate {
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
  categoria: CategoriaGasto
  valor: number
  status: StatusContaPagar
  tipo: TipoContaPagar
  observacao: string | null
}

export interface ContasPagarDiaData {
  data: string
  total: number
  contas: ContaPagarDiaItem[]
}

// ─── Baixas de Dívidas ────────────────────────────────────────────────────────

export interface Baixa {
  id: string
  divida_id: string
  divida_descricao: string
  divida_credor: string | null
  data_referencia: string
  data_pagamento: string | null
  valor_pago: number
  valor_parcela_original: number
  observacao: string | null
}

// ─── Listas (Afazeres e Compras) ───────────────────────────────────────────

export interface Tarefa {
  id: string
  titulo: string
  concluida: boolean
  criado_em: string
  atualizado_em: string
}

export interface ItemCompra {
  id: string
  nome: string
  quantidade: number
  unidade: string | null
  comprado: boolean
  observacao: string | null
  criado_em: string
  atualizado_em: string
}

// ─── Planos e Assinaturas ─────────────────────────────────────────────────────

export type NomePlano = 'gratuito' | 'premium' | 'pro'

export interface PlanoEntitlements {
  nome: NomePlano
  rotulo: string
  descricao: string
  preco_mensal: number
  preco_anual: number
  /** Limite de volume por recurso; `null` = ilimitado */
  limites: Record<string, number | null>
  /** Funcionalidades liberadas pelo plano */
  recursos: string[]
  uso?: {
    planos_ia_mes: number
    chat_msgs_mes: number
  }
}

export interface PlanoCatalogo {
  planos: PlanoEntitlements[]
}

// ─── Assinaturas e pagamentos ────────────────────────────────────────────────

export interface AssinaturaInfo {
  id: string
  plano: string
  rotulo: string
  status: string
  gateway: string
  preco_mensal: number
  data_inicio: string | null
  data_proxima_cobranca: string | null
  cancelada_em: string | null
  criado_em: string
}

export interface PagamentoInfo {
  id: string
  assinatura_id: string | null
  plano: string
  metodo: 'pix' | 'cartao'
  valor: number
  status: string
  gateway: string
  gateway_pagamento_id: string | null
  qr_code: string | null
  qr_base64: string | null
  url_pagamento: string | null
  expira_em: string | null
  criado_em: string | null
  pago_em: string | null
}

export interface CheckoutResponse {
  pagamento: PagamentoInfo
  assinatura: AssinaturaInfo
  simulavel: boolean
}

export interface AssinaturaMe {
  assinatura: AssinaturaInfo | null
  pagamentos: PagamentoInfo[]
}

// ─── Família / multi-usuário ────────────────────────────────────────────────

export type FamiliaPapel = 'titular' | 'membro' | 'convidado' | 'nenhum'

export interface FamiliaTitular {
  id: string
  nome: string
  email: string
}

export interface ConviteFamilia {
  id: string
  email: string
  status: string
  criado_em: string | null
  token: string | null
}

export interface MembroFamilia {
  id: string
  email: string
  nome: string | null
  status: string
  aceito_em: string | null
  criado_em: string | null
}

export interface FamiliaContexto {
  papel: FamiliaPapel
  titular: FamiliaTitular | null
  convites: ConviteFamilia[]
  membros: MembroFamilia[]
  convite: ConviteFamilia | null
  limite_membros: number | null
  vagas: number | null
  pode_convidar: boolean
}

export interface ConviteCriado {
  convite: ConviteFamilia
  limite_membros: number | null
  vagas: number | null
}
