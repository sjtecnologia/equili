import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { notify } from '@/utils/notify'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Só notifica se não há dados em cache (falha na primeira carga)
      if (!query.state.data) {
        notify.apiError(error, 'Erro ao carregar dados')
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
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
