import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { ContaAPagar } from '@/types/financeiro'

export function useContasPagar() {
  const qc = useQueryClient()

  const query = useQuery<ContaAPagar[]>({
    queryKey: ['contas-pagar'],
    queryFn: () => api.get('/contas-pagar').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const deletar = useMutation({
    mutationFn: (id: string) => api.delete(`/contas-pagar/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const pagar = useMutation({
    mutationFn: (id: string) => api.patch(`/contas-pagar/${id}/pagar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['contas-pagar'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }, [qc])

  return { ...query, deletar, pagar, invalidate }
}
