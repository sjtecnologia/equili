import type { QueryClient, QueryKey } from '@tanstack/react-query'

function invalidateMany(queryClient: QueryClient, keys: QueryKey[]) {
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

export function invalidateContasPagarAndDashboard(queryClient: QueryClient) {
  return invalidateMany(queryClient, [['contas-pagar'], ['dashboard'], ['baixas-contas'], ['relatorio-detalhado'], ['contas-pagar-dia'], ['fluxo-caixa'], ['contas-pagar-pendentes-plano'], ['dividas'], ['divida-baixas'], ['contas-fixas-atrasadas']])
}

/** Baixas geram lançamentos em conta/cartão: recarrega saldos e limites. */
export function invalidateSaldos(queryClient: QueryClient) {
  return invalidateMany(queryClient, [['contas-bancarias'], ['conta-lancamentos'], ['cartoes-credito'], ['cartao-lancamentos']])
}

export function invalidateContasReceberAndDashboard(queryClient: QueryClient) {
  return invalidateMany(queryClient, [['contas-receber'], ['dashboard'], ['baixas-contas'], ['relatorio-detalhado'], ['contas-pagar-dia'], ['fluxo-caixa'], ['contas-receber-pendentes-plano']])
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
