import { useQuery } from '@tanstack/react-query'
import { meuPlano } from '@/services/api'
import type { PlanoEntitlements } from '@/types/financeiro'

/**
 * Entitlements do plano do usuário logado.
 * Ex.: `temRecurso('investimentos')`, `limite('dividas_ativas')`.
 */
export function usePlano() {
  const { data, isLoading } = useQuery<PlanoEntitlements | null>({
    queryKey: ['meu-plano'],
    queryFn: () => meuPlano().catch(() => null),
    staleTime: 60_000,
  })

  const recursos = new Set(data?.recursos ?? [])

  return {
    data,
    isLoading,
    plano: data?.nome ?? 'gratuito',
    rotulo: data?.rotulo ?? 'Gratuito',
    temRecurso: (recurso: string) => recursos.has(recurso),
    limite: (recurso: string): number | null => data?.limites?.[recurso] ?? null,
  }
}