import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { DashboardResumo, ContaBancaria, CartaoCredito } from '@/types/financeiro'

export function useDashboard() {
  const resumo = useQuery<DashboardResumo>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/resumo').then((r) => r.data),
    staleTime: 30_000,
  })

  const contas = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/contas-bancarias').then((r) => r.data),
  })

  const cartoes = useQuery<CartaoCredito[]>({
    queryKey: ['cartoes-credito'],
    queryFn: () => api.get('/cartoes-credito').then((r) => r.data),
  })

  return { resumo, contas, cartoes }
}
