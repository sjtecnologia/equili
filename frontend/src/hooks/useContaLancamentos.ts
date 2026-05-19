import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { ContaLancamentosData } from '@/types/financeiro'

export function useContaLancamentos(contaId: string | undefined) {
  const qc = useQueryClient()
  const queryKey = useMemo(() => ['conta-lancamentos', contaId], [contaId])

  const query = useQuery<ContaLancamentosData>({
    queryKey,
    queryFn: () => api.get(`/contas-bancarias/${contaId}/lancamentos`).then((r) => r.data),
    enabled: !!contaId,
    retry: 1,
    staleTime: 5 * 60_000,
  })

  const deletarMutation = useMutation({
    mutationFn: (lancamentoId: string) =>
      api.delete(`/contas-bancarias/${contaId}/lancamentos/${lancamentoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const deletar = (lancamentoId: string) => deletarMutation.mutate(lancamentoId)

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey })
    qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
  }, [qc, queryKey])

  return { ...query, deletar, invalidate }
}
