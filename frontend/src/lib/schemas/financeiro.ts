import { z } from 'zod'

// ─── Contas Bancárias ─────────────────────────────────────────────────────────

export const contaBancariaSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  banco: z.string().min(1, 'Banco obrigatório'),
  tipo: z.enum(['corrente', 'poupanca', 'investimento', 'digital']),
  saldo_inicial: z.coerce.number().min(0, 'Saldo não pode ser negativo'),
  cor: z.string().default('#2E7D5E'),
})
export type ContaBancariaFormData = z.infer<typeof contaBancariaSchema>

export const cartaoCreditoSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  bandeira: z.enum(['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro']),
  limite: z.coerce.number().positive('Limite deve ser positivo'),
  dia_fechamento: z.coerce.number().int().min(1).max(31),
  dia_vencimento: z.coerce.number().int().min(1).max(31),
  cor: z.string().default('#1A3C5E'),
})
export type CartaoCreditoFormData = z.infer<typeof cartaoCreditoSchema>

// ─── Contas a Pagar ───────────────────────────────────────────────────────────

export const contaPagarSchema = z
  .object({
    descricao: z.string().min(1, 'Descrição obrigatória'),
    categoria: z.string().min(1, 'Selecione a categoria'),
    valor: z.coerce.number().positive('Valor deve ser positivo'),
    data_vencimento: z.string().min(1, 'Data obrigatória'),
    modalidade: z.enum(['avulsa', 'recorrente', 'parcelada']),
    numero_parcelas: z.coerce.number().int().min(2).optional().nullable(),
    observacao: z.string().optional(),
  })
  .refine(
    (d) => d.modalidade !== 'parcelada' || (d.numero_parcelas != null && d.numero_parcelas >= 2),
    { message: 'Informe ao menos 2 parcelas', path: ['numero_parcelas'] }
  )
export type ContaPagarFormData = z.infer<typeof contaPagarSchema>

export const editarContaPagarSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  categoria: z.string().min(1),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data_vencimento: z.string().min(1, 'Data obrigatória'),
  tipo: z.enum(['avulsa', 'fixa', 'variavel']),
  observacao: z.string().optional(),
})
export type EditarContaPagarFormData = z.infer<typeof editarContaPagarSchema>

// ─── Contas a Receber ─────────────────────────────────────────────────────────

export const contaReceberSchema = z
  .object({
    descricao: z.string().min(1, 'Descrição obrigatória'),
    origem: z.string().min(1, 'Selecione a origem'),
    valor: z.coerce.number().positive('Valor deve ser positivo'),
    data_prevista: z.string().min(1, 'Data obrigatória'),
    modalidade: z.enum(['avulsa', 'recorrente', 'parcelada']),
    numero_parcelas: z.coerce.number().int().min(2).optional().nullable(),
    devedor: z.string().optional(),
    observacao: z.string().optional(),
  })
  .refine(
    (d) => d.modalidade !== 'parcelada' || (d.numero_parcelas != null && d.numero_parcelas >= 2),
    { message: 'Informe ao menos 2 parcelas', path: ['numero_parcelas'] }
  )
export type ContaReceberFormData = z.infer<typeof contaReceberSchema>

export const editarContaReceberSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  origem: z.string().min(1),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data_prevista: z.string().min(1, 'Data obrigatória'),
  tipo: z.enum(['avulsa', 'recorrente', 'parcelada']),
  devedor: z.string().optional(),
  observacao: z.string().optional(),
})
export type EditarContaReceberFormData = z.infer<typeof editarContaReceberSchema>

// ─── Dívidas ─────────────────────────────────────────────────────────────────

export const dividaSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  credor: z.string().optional(),
  tipo: z.string().min(1, 'Tipo obrigatório'),
  valor_total: z.coerce.number().positive('Valor deve ser positivo'),
  valor_parcela: z.coerce.number().positive('Valor da parcela deve ser positivo'),
  parcelas_totais: z.coerce.number().int().min(1).optional().nullable(),
  parcelas_restantes: z.coerce.number().int().min(1, 'Mínimo 1 parcela'),
  taxa_juros_mensal: z.coerce.number().min(0).optional().nullable(),
  data_inicio_contrato: z.string().optional(),
  data_primeira_parcela: z.string().min(1, 'Data da primeira parcela obrigatória'),
})
export type DividaFormData = z.infer<typeof dividaSchema>

// ─── Investimentos ───────────────────────────────────────────────────────────

export const investimentoSchema = z.object({
  nome: z.string().min(1, 'Informe o nome'),
  tipo: z.enum(['acoes', 'fii', 'renda_fixa', 'criptomoeda', 'tesouro', 'outro']),
  instituicao: z.string().optional(),
  quantidade: z.number().optional(),
  preco_medio: z.number().optional(),
  valor_investido: z
    .number({ invalid_type_error: 'Informe o valor' })
    .positive('Deve ser maior que zero'),
  valor_atual: z.number({ invalid_type_error: 'Informe o valor' }).min(0),
  data_aplicacao: z.string().min(1, 'Informe a data'),
  observacao: z.string().optional(),
})
export type InvestimentoFormData = z.infer<typeof investimentoSchema>

// ─── Renda ───────────────────────────────────────────────────────────────────

export const rendaSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  frequencia: z.string().min(1, 'Selecione a frequência'),
  tipo: z.string().min(1, 'Selecione o tipo'),
})
export type RendaFormData = z.infer<typeof rendaSchema>

// ─── Lançamentos ─────────────────────────────────────────────────────────────

export const lancamentoContaSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  tipo: z.enum(['entrada', 'saida']),
  data: z.string().min(1, 'Data obrigatória'),
  categoria: z.string().optional(),
})
export type LancamentoContaFormData = z.infer<typeof lancamentoContaSchema>

export const lancamentoCartaoSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  tipo: z.enum(['compra', 'pagamento']),
  data: z.string().min(1, 'Data obrigatória'),
  categoria: z.string().optional(),
})
export type LancamentoCartaoFormData = z.infer<typeof lancamentoCartaoSchema>
