import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import { FiltrosBarra, CAMPOS_PERIODO, type CampoFiltro } from './FiltrosBarra'

export function descreverFiltros(filtros: Record<string, string>) {
  const nomes: Record<string, string> = { q: 'Descrição', tipo: 'Tipo', categoria: 'Categoria / origem', status: 'Situação', data_inicio: 'De', data_fim: 'Até' }
  const valores: Record<string, string> = { avulsa: 'Avulsa', recorrente: 'Recorrente', parcelada: 'Parcelada', pendente: 'Em aberto', parcial: 'Parcial', liquidado: 'Liquidado', vencido: 'Vencido', entrada: 'Entrada', saida: 'Saída', compra: 'Compra', pagamento: 'Pagamento / estorno' }
  return Object.entries(filtros).map(([k, v]) => `${nomes[k] ?? k}: ${k === 'tipo' || k === 'status' ? valores[v] ?? v : v}`).join(' · ') || 'Todos os lançamentos'
}

export function RelatorioFiltros({ onFiltrar, filtros, periodo = true, extrato }: {
  onFiltrar: (filtros: Record<string, string>) => void
  filtros: Record<string, string>
  periodo?: boolean
  extrato?: 'conta' | 'cartao'
}) {
  const { data: categorias = [] } = useQuery<{ nome: string }[]>({
    queryKey: ['categorias-relatorio'], queryFn: () => api.get('/categorias').then(r => r.data),
  })
  const tipos = extrato === 'conta'
    ? [{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]
    : extrato === 'cartao' ? [{ value: 'compra', label: 'Compra' }, { value: 'pagamento', label: 'Pagamento / estorno' }]
    : [{ value: 'avulsa', label: 'Avulsa' }, { value: 'recorrente', label: 'Recorrente' }, { value: 'parcelada', label: 'Parcelada' }]
  const campos: CampoFiltro[] = [
    { key: 'q', tipo: 'busca', placeholder: 'Buscar descrição' },
    { key: 'tipo', tipo: 'select', label: 'Tipo de lançamento', opcoes: tipos },
    { key: 'categoria', tipo: 'select', label: 'Categoria / origem', opcoes: [...new Set(categorias.map(c => c.nome))].sort().map(nome => ({ value: nome, label: nome })) },
    ...(!extrato ? [{ key: 'status', tipo: 'select' as const, label: 'Situação', opcoes: [
      { value: 'pendente', label: 'Em aberto' }, { value: 'parcial', label: 'Parcial' },
      { value: 'liquidado', label: 'Liquidado' }, { value: 'vencido', label: 'Vencido' },
    ] }] : []),
    ...(periodo ? CAMPOS_PERIODO : []),
  ]
  return <>
    <div className="print:hidden"><FiltrosBarra campos={campos} onFiltrar={onFiltrar} /></div>
    <p className="text-xs text-gray-500 break-words">{descreverFiltros(filtros)}</p>
  </>
}
