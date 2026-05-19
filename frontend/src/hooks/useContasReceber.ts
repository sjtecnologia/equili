import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { ContaAReceber } from '@/types/financeiro'

export function useContasReceber() {
  const qc = useQueryClient()

  const query = useQuery<ContaAReceber[]>({
    queryKey: ['contas-receber'],
    queryFn: () => api.get('/contas-receber').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const deletar = useMutation({
    mutationFn: (id: string) => api.delete(`/contas-receber/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['contas-receber'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }, [qc])

  return { ...query, deletar, invalidate }
}
