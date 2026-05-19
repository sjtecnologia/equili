import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { ContaAPagar, ContaAReceber, PlanoAcao } from '@/types/financeiro'

export function usePlanoAcao() {
  const queryClient = useQueryClient()
  const [limitError, setLimitError] = useState(false)
  const [erroGerar, setErroGerar] = useState<string | null>(null)

  const { data: plano, isLoading } = useQuery<PlanoAcao | null>({
    queryKey: ['plano-atual'],
    queryFn: () =>
      api
        .get('/plano-acao/atual')
        .then((r) => r.data)
        .catch(() => null),
  })

  const { data: contasPagar } = useQuery<ContaAPagar[]>({
    queryKey: ['contas-pagar-pendentes-plano'],
    queryFn: () => api.get('/contas-pagar?status=pendente').then((r) => r.data),
  })

  const { data: contasReceber } = useQuery<ContaAReceber[]>({
    queryKey: ['contas-receber-pendentes-plano'],
    queryFn: () => api.get('/contas-receber?status=pendente').then((r) => r.data),
  })

  const gerarMutation = useMutation({
    mutationFn: () => api.post('/plano-acao/gerar'),
    onMutate: () => {
      setErroGerar(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano-atual'] })
    },
    onError: (err: { response?: { status: number; data?: { detail?: string } } }) => {
      if (err.response?.status === 403) setLimitError(true)
      else if (err.response?.status === 400)
        setErroGerar(err.response.data?.detail ?? 'Não foi possível gerar o plano.')
      else setErroGerar('Erro ao gerar o plano. Tente novamente.')
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) =>
      api.post(`/plano-acao/${id}/feedback`, { feedback: valor }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plano-atual'] }),
  })

  return {
    plano,
    isLoading,
    limitError,
    erroGerar,
    contasPagar: contasPagar ?? [],
    contasReceber: contasReceber ?? [],
    gerar: () => gerarMutation.mutate(),
    isGerando: gerarMutation.isPending,
    darFeedback: feedbackMutation.mutate,
  }
}
