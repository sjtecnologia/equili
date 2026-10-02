import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Divida, ContaFixaAtrasada } from '@/types/financeiro'

export function useDividas(filtros: Record<string, string> = {}) {
  const qc = useQueryClient()
  const temFiltro = Object.keys(filtros).length > 0

  const query = useQuery<Divida[]>({
    queryKey: ['dividas', filtros],
    queryFn: () => api.get('/dividas', { params: filtros }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  // Resumo e limite do plano usam sempre a lista completa (mesma chave de cache quando não há filtro)
  const todasQuery = useQuery<Divida[]>({
    queryKey: ['dividas', {}],
    queryFn: () => api.get('/dividas').then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled: temFiltro,
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
    todas: (temFiltro ? todasQuery.data : query.data) ?? [],
    contasFixasAtrasadas: contasFixasAtrasadas.data ?? [],
    deletar,
    invalidate,
  }
}
