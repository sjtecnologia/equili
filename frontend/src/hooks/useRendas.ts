import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Renda } from '@/types/financeiro'

export function useRendas() {
  const qc = useQueryClient()

  const query = useQuery<Renda[]>({
    queryKey: ['rendas'],
    queryFn: () => api.get('/rendas').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const deletar = useMutation({
    mutationFn: (id: string) => api.delete(`/rendas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rendas'] }),
  })

  return { ...query, deletar }
}
