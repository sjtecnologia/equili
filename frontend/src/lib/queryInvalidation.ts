import type { QueryClient, QueryKey } from '@tanstack/react-query'

function invalidateMany(queryClient: QueryClient, keys: QueryKey[]) {
  keys.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey })
  })
}

export function invalidateContasPagarAndDashboard(queryClient: QueryClient) {
  invalidateMany(queryClient, [['contas-pagar'], ['dashboard']])
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