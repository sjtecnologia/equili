import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Investimento, CarteiraResumo } from '@/types/financeiro'

export function useInvestimentos(filtros: Record<string, string> = {}) {
  const qc = useQueryClient()

  const listaQuery = useQuery<Investimento[]>({
    queryKey: ['investimentos', filtros],
    queryFn: () => api.get('/investimentos', { params: filtros }).then((r) => r.data),
  })

  const resumoQuery = useQuery<CarteiraResumo>({
    queryKey: ['investimentos-resumo'],
    queryFn: () => api.get('/investimentos/resumo').then((r) => r.data),
  })

  const deletar = useMutation({
    mutationFn: (id: string) => api.delete(`/investimentos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investimentos'] })
      qc.invalidateQueries({ queryKey: ['investimentos-resumo'] })
    },
  })

  return {
    lista: listaQuery.data ?? [],
    resumo: resumoQuery.data,
    isLoading: listaQuery.isLoading,
    isError: listaQuery.isError,
    deletar,
  }
}
