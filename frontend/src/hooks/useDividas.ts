import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Divida, ContaFixaAtrasada } from '@/types/financeiro'

export function useDividas() {
  const qc = useQueryClient()

  const query = useQuery<Divida[]>({
    queryKey: ['dividas'],
    queryFn: () => api.get('/dividas').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const contasFixasAtrasadas = useQuery<ContaFixaAtrasada[]>({
    queryKey: ['contas-fixas-atrasadas'],
    queryFn: () => api.get('/contas-pagar/fixas-atrasadas').then((r) => r.data),
  })

  const deletar = useMutation({
    mutationFn: (id: string) => api.delete(`/dividas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dividas'] }),
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['dividas'] })
  }, [qc])

  return {
    ...query,
    contasFixasAtrasadas: contasFixasAtrasadas.data ?? [],
    deletar,
    invalidate,
  }
}
