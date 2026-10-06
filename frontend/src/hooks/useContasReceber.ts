import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import { invalidateContasReceberAndDashboard } from '@/lib/queryInvalidation'
import type { ContaAReceber } from '@/types/financeiro'
import { notify } from '@/utils/notify'
import { parseApiError } from '@/utils/api'

export function useContasReceber(params: Record<string, string> = {}) {
  const qc = useQueryClient()

  const query = useQuery<ContaAReceber[]>({
    queryKey: ['contas-receber', params],
    queryFn: () => api.get('/contas-receber', { params }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const deletar = useMutation({
    mutationFn: (id: string) => api.delete(`/contas-receber/${id}`),
    onError: (e) => notify.error(parseApiError(e)),
    onSuccess: () => invalidateContasReceberAndDashboard(qc),
  })

  const invalidate = useCallback(() => {
    invalidateContasReceberAndDashboard(qc)
  }, [qc])

  return { ...query, deletar, invalidate }
}
