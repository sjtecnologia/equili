import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api from '@/services/api'
import type { CartaoLancamentosData } from '@/types/financeiro'

export function useCartaoLancamentos(cartaoId: string | undefined, filtros: Record<string, string> = {}) {
  const qc = useQueryClient()
  // Chave base: invalidar por ela atinge todas as variantes filtradas
  const queryKey = useMemo(() => ['cartao-lancamentos', cartaoId], [cartaoId])
  const temFiltro = Object.keys(filtros).length > 0

  const query = useQuery<CartaoLancamentosData>({
    queryKey: [...queryKey, filtros],
    queryFn: () => api.get(`/cartoes-credito/${cartaoId}/lancamentos`, { params: filtros }).then((r) => r.data),
    enabled: !!cartaoId,
    retry: 1,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  // Extrato e totais precisam da lista completa, independente dos filtros
  const completoQuery = useQuery<CartaoLancamentosData>({
    queryKey: [...queryKey, {}],
    queryFn: () => api.get(`/cartoes-credito/${cartaoId}/lancamentos`).then((r) => r.data),
    enabled: !!cartaoId && temFiltro,
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

  const completo = (temFiltro ? completoQuery.data : query.data)?.lancamentos ?? []

  return { ...query, completo, deletar, invalidate }
}
