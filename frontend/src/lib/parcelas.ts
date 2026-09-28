import type { Divida } from '@/types/financeiro'

export interface ParcelaProjetada { numero: number; vencimento: Date }

export function gerarAgendaParcelas(divida: Pick<Divida, 'data_prox_vencimento' | 'parcelas_restantes'>): ParcelaProjetada[] {
  const agenda: ParcelaProjetada[] = []
  if (!divida.data_prox_vencimento) return agenda
  const base = new Date(divida.data_prox_vencimento + 'T00:00:00')
  const total = Math.min(divida.parcelas_restantes, 480)
  for (let i = 0; i < total; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate())
    agenda.push({ numero: i + 1, vencimento: d })
  }
  return agenda
}
