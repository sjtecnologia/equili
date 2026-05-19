import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { ContaBancaria, CartaoCredito } from '@/types/financeiro'

export function useContas() {
  const qc = useQueryClient()

  const contasQuery = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/contas-bancarias').then((r) => r.data),
  })

  const cartoesQuery = useQuery<CartaoCredito[]>({
    queryKey: ['cartoes-credito'],
    queryFn: () => api.get('/cartoes-credito').then((r) => r.data),
  })

  const deletarConta = useMutation({
    mutationFn: (id: string) => api.delete(`/contas-bancarias/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas-bancarias'] }),
  })

  const deletarCartao = useMutation({
    mutationFn: (id: string) => api.delete(`/cartoes-credito/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cartoes-credito'] }),
  })

  return {
    contasQuery,
    cartoesQuery,
    contas: contasQuery.data ?? [],
    cartoes: cartoesQuery.data ?? [],
    isLoading: contasQuery.isLoading || cartoesQuery.isLoading,
    deletarConta,
    deletarCartao,
  }
}
