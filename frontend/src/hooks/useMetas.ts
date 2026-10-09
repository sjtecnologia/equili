import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Meta, MetaPayload, MetasResponse } from '@/types/financeiro'

const METAS_KEY = ['metas']

/**
 * Metas financeiras: listagem + mutações (criar, editar, aportar, excluir).
 * O limite do plano é verificado no backend (429) e também exibido na tela.
 */
export function useMetas() {
  const qc = useQueryClient()

  const query = useQuery<MetasResponse>({
    queryKey: METAS_KEY,
    queryFn: () => api.get('/metas').then((r) => r.data),
    staleTime: 30_000,
  })

  const criar = useMutation({
    mutationFn: (payload: MetaPayload) => api.post('/metas', payload).then((r) => r.data as Meta),
    onSuccess: () => qc.invalidateQueries({ queryKey: METAS_KEY }),
  })

  const atualizar = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MetaPayload> & { concluida?: boolean } }) =>
      api.patch(`/metas/${id}`, payload).then((r) => r.data as Meta),
    onSuccess: () => qc.invalidateQueries({ queryKey: METAS_KEY }),
  })

  const aportar = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) =>
      api.post(`/metas/${id}/aportar`, { valor }).then((r) => r.data as Meta),
    onSuccess: () => qc.invalidateQueries({ queryKey: METAS_KEY }),
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/metas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: METAS_KEY }),
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: METAS_KEY })
  }, [qc])

  return {
    ...query,
    metas: query.data?.metas ?? [],
    total: query.data?.total ?? 0,
    ativas: query.data?.ativas ?? 0,
    criar,
    atualizar,
    aportar,
    excluir,
    invalidate,
  }
}