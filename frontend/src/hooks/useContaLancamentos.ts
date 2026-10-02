import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api from '@/services/api'
import type { ContaLancamentosData } from '@/types/financeiro'

export function useContaLancamentos(contaId: string | undefined, filtros: Record<string, string> = {}) {
  const qc = useQueryClient()
  // Chave base: invalidar por ela atinge todas as variantes filtradas
  const queryKey = useMemo(() => ['conta-lancamentos', contaId], [contaId])
  const temFiltro = Object.keys(filtros).length > 0

  const query = useQuery<ContaLancamentosData>({
    queryKey: [...queryKey, filtros],
    queryFn: () => api.get(`/contas-bancarias/${contaId}/lancamentos`, { params: filtros }).then((r) => r.data),
    enabled: !!contaId,
    retry: 1,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  // Extrato e totais precisam da lista completa, independente dos filtros
  const completoQuery = useQuery<ContaLancamentosData>({
    queryKey: [...queryKey, {}],
    queryFn: () => api.get(`/contas-bancarias/${contaId}/lancamentos`).then((r) => r.data),
    enabled: !!contaId && temFiltro,
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

  const completo = (temFiltro ? completoQuery.data : query.data)?.lancamentos ?? []

  return { ...query, completo, deletar, invalidate }
}
