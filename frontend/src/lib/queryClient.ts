import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { notify } from '@/utils/notify'

/**
 * 402 = recurso bloqueado pelo plano (paywall). Não é uma falha: a própria
 * tela do recurso já sinaliza o bloqueio (Paywall / botão de upgrade). Sem este
 * filtro, o dashboard dispara um toast "Faça upgrade para liberar" logo após o
 * login, para usuários do plano Gratuito.
 */
function isPlanGate(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 402
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Só notifica se não há dados em cache (falha na primeira carga)
      if (isPlanGate(error)) return
      if (!query.state.data) {
        notify.apiError(error, 'Erro ao carregar dados')
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isPlanGate(error)) return
      notify.apiError(error)
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutos
    },
  },
})
