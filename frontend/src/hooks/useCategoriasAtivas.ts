import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

export interface CategoriaItem {
  id: string
  nome: string
  tipo: 'despesa' | 'receita'
  cor: string | null
  icone: string | null
  ativo: boolean
}

export function useCategoriasAtivas(tipo: 'despesa' | 'receita') {
  return useQuery<CategoriaItem[]>({
    queryKey: ['categorias', 'ativas', tipo],
    queryFn: () => api.get('/categorias', { params: { tipo, ativo: true } }).then((r) => r.data),
    staleTime: 60_000,
    retry: false,
  })
}
