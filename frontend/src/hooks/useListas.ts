import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { ItemCompra, Tarefa } from '@/types/financeiro'

interface CriarTarefaPayload {
  titulo: string
}

interface AtualizarTarefaPayload {
  id: string
  titulo?: string
  concluida?: boolean
}

interface CriarItemCompraPayload {
  nome: string
  quantidade: number
  unidade?: string
  observacao?: string
}

interface AtualizarItemCompraPayload {
  id: string
  nome?: string
  quantidade?: number
  unidade?: string
  comprado?: boolean
  observacao?: string
}

export function useListas(filtros: Record<string, string> = {}) {
  const qc = useQueryClient()
  const temFiltro = Object.keys(filtros).length > 0

  // status: 'pendente' | 'concluido' (concluído em tarefas, comprado em compras)
  const feito = filtros.status === 'concluido' ? 'true' : filtros.status === 'pendente' ? 'false' : undefined
  const paramsTarefas: Record<string, string> = {
    ...(filtros.q ? { q: filtros.q } : {}),
    ...(feito ? { concluida: feito } : {}),
  }
  const paramsCompras: Record<string, string> = {
    ...(filtros.q ? { q: filtros.q } : {}),
    ...(feito ? { comprado: feito } : {}),
  }

  const tarefasQuery = useQuery<Tarefa[]>({
    queryKey: ['listas-tarefas', paramsTarefas],
    queryFn: () => api.get('/listas/tarefas', { params: paramsTarefas }).then((r) => r.data),
  })

  const comprasQuery = useQuery<ItemCompra[]>({
    queryKey: ['listas-compras', paramsCompras],
    queryFn: () => api.get('/listas/compras', { params: paramsCompras }).then((r) => r.data),
  })

  // Contadores das abas usam a lista completa (mesma chave de cache quando não há filtro)
  const tarefasTodasQuery = useQuery<Tarefa[]>({
    queryKey: ['listas-tarefas', {}],
    queryFn: () => api.get('/listas/tarefas').then((r) => r.data),
    enabled: temFiltro,
  })
  const comprasTodasQuery = useQuery<ItemCompra[]>({
    queryKey: ['listas-compras', {}],
    queryFn: () => api.get('/listas/compras').then((r) => r.data),
    enabled: temFiltro,
  })

  const criarTarefa = useMutation({
    mutationFn: (payload: CriarTarefaPayload) => api.post('/listas/tarefas', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listas-tarefas'] }),
  })

  const atualizarTarefa = useMutation({
    mutationFn: ({ id, ...payload }: AtualizarTarefaPayload) => api.patch(`/listas/tarefas/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listas-tarefas'] }),
  })

  const removerTarefa = useMutation({
    mutationFn: (id: string) => api.delete(`/listas/tarefas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listas-tarefas'] }),
  })

  const criarItemCompra = useMutation({
    mutationFn: (payload: CriarItemCompraPayload) => api.post('/listas/compras', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listas-compras'] }),
  })

  const atualizarItemCompra = useMutation({
    mutationFn: ({ id, ...payload }: AtualizarItemCompraPayload) => api.patch(`/listas/compras/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listas-compras'] }),
  })

  const removerItemCompra = useMutation({
    mutationFn: (id: string) => api.delete(`/listas/compras/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listas-compras'] }),
  })

  return {
    tarefas: tarefasQuery.data ?? [],
    compras: comprasQuery.data ?? [],
    tarefasTodas: (temFiltro ? tarefasTodasQuery.data : tarefasQuery.data) ?? [],
    comprasTodas: (temFiltro ? comprasTodasQuery.data : comprasQuery.data) ?? [],
    isLoading: tarefasQuery.isLoading || comprasQuery.isLoading,
    criarTarefa,
    atualizarTarefa,
    removerTarefa,
    criarItemCompra,
    atualizarItemCompra,
    removerItemCompra,
  }
}
