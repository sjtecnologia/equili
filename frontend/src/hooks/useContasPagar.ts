import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import { invalidateContasPagarAndDashboard } from '@/lib/queryInvalidation'
import type { ContaAPagar } from '@/types/financeiro'

export function useContasPagar(params: Record<string, string> = {}) {
  const qc = useQueryClient()

  const query = useQuery<ContaAPagar[]>({
    queryKey: ['contas-pagar', params],
    queryFn: () => api.get('/contas-pagar', { params }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const deletar = useMutation({
    mutationFn: (id: string) => api.delete(`/contas-pagar/${id}`),
    onSuccess: () => invalidateContasPagarAndDashboard(qc),
  })

  const pagar = useMutation({
    mutationFn: (id: string) => api.patch(`/contas-pagar/${id}/pagar`),
    onSuccess: () => invalidateContasPagarAndDashboard(qc),
  })

  const invalidate = useCallback(() => {
    invalidateContasPagarAndDashboard(qc)
  }, [qc])

  return { ...query, deletar, pagar, invalidate }
}
