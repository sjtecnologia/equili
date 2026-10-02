import type { QueryClient, QueryKey } from '@tanstack/react-query'

function invalidateMany(queryClient: QueryClient, keys: QueryKey[]) {
  keys.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey })
  })
}

export function invalidateContasPagarAndDashboard(queryClient: QueryClient) {
  invalidateMany(queryClient, [['contas-pagar'], ['dashboard']])
}

/** Baixas geram lançamentos em conta/cartão: recarrega saldos e limites. */
export function invalidateSaldos(queryClient: QueryClient) {
  invalidateMany(queryClient, [['contas-bancarias'], ['cartoes-credito']])
}

export function invalidateContasReceberAndDashboard(queryClient: QueryClient) {
  invalidateMany(queryClient, [['contas-receber'], ['dashboard']])
}

export function invalidateFinanceiroBase(queryClient: QueryClient, includeRendas = false) {
  const keys: QueryKey[] = [['contas-pagar'], ['contas-receber'], ['dashboard']]
  if (includeRendas) {
    keys.push(['rendas'])
  }
  invalidateMany(queryClient, keys)
}

export function invalidateDividasAndAtrasos(queryClient: QueryClient) {
  invalidateMany(queryClient, [['dividas'], ['contas-fixas-atrasadas']])
}

export function invalidateDividasAtrasosAndBaixas(queryClient: QueryClient) {
  invalidateMany(queryClient, [['dividas'], ['contas-fixas-atrasadas'], ['divida-baixas']])
}