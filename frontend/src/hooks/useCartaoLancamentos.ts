import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { CartaoLancamentosData } from '@/types/financeiro'

export function useCartaoLancamentos(cartaoId: string | undefined) {
  const qc = useQueryClient()
  const queryKey = useMemo(() => ['cartao-lancamentos', cartaoId], [cartaoId])

  const query = useQuery<CartaoLancamentosData>({
    queryKey,
    queryFn: () => api.get(`/cartoes-credito/${cartaoId}/lancamentos`).then((r) => r.data),
    enabled: !!cartaoId,
    retry: 1,
    staleTime: 5 * 60_000,
  })

  const deletarMutation = useMutation({
    mutationFn: (lancamentoId: string) =>
      api.delete(`/cartoes-credito/${cartaoId}/lancamentos/${lancamentoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const deletar = (lancamentoId: string) => deletarMutation.mutate(lancamentoId)

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey })
    qc.invalidateQueries({ queryKey: ['cartoes-credito'] })
  }, [qc, queryKey])

  return { ...query, deletar, invalidate }
}
