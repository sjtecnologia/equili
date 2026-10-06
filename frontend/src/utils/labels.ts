import type {
  CategoriaGasto,
  OrigemRenda,
  StatusContaPagar,
  StatusContaReceber,
} from '@/types/financeiro'

export const CATEGORIAS_LABEL: Record<CategoriaGasto, string> = {
  moradia: 'Moradia',
  transporte: 'Transporte',
  saude: 'Saúde',
  educacao: 'Educação',
  alimentacao: 'Alimentação',
  lazer: 'Lazer',
  outro: 'Outro',
}

export const ORIGENS_LABEL: Record<OrigemRenda, string> = {
  salario: 'Salário',
  freela: 'Freelance',
  venda: 'Venda',
  emprestimo: 'Empréstimo',
  outro: 'Outro',
}

export const STATUS_PAGAR: Record<StatusContaPagar, { label: string; classes: string }> = {
  parcial: { label: 'Parcial', classes: 'bg-blue-100 text-blue-700' },
  pendente: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  pago: { label: 'Pago', classes: 'bg-green-100 text-green-700' },
  vencido: { label: 'Vencido', classes: 'bg-red-100 text-red-700' },
}

export const STATUS_RECEBER: Record<StatusContaReceber, { label: string; classes: string }> = {
  parcial: { label: 'Parcial', classes: 'bg-blue-100 text-blue-700' },
  pendente: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  recebido: { label: 'Recebido', classes: 'bg-green-100 text-green-700' },
  atrasado: { label: 'Atrasado', classes: 'bg-red-100 text-red-700' },
}
