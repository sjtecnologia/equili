import { FiltrosBarra, limparFiltrosVazios, CAMPOS_PERIODO, type CampoFiltro } from './FiltrosBarra'
import { useCategoriasAtivas } from '@/hooks/useCategoriasAtivas'

export { limparFiltrosVazios }

export interface ContasFiltros {
  q?: string
  status?: string
  categoria?: string
  parcela?: string
  data_inicio?: string
  data_fim?: string
  tipo?: string
}

interface Props {
  statusOptions: { value: string; label: string }[]
  tipoCategoria: 'despesa' | 'receita'
  onFiltrar: (filtros: ContasFiltros) => void
}

export function ContasFiltrosBar({ statusOptions, tipoCategoria, onFiltrar }: Props) {
  const { data: categorias = [], isError: categoriasErro } = useCategoriasAtivas(tipoCategoria)

  const campos: CampoFiltro[] = [
    { key: 'q', tipo: 'busca', placeholder: 'Buscar (descrição ou parcela)' },
    { key: 'status', tipo: 'select', label: 'Status', opcoes: statusOptions },
    { key: 'tipo', tipo: 'select', label: 'Tipo de lançamento', opcoes: [
      { value: 'avulsa', label: 'Avulsa' },
      { value: tipoCategoria === 'despesa' ? 'fixa' : 'recorrente', label: 'Recorrente' },
      { value: tipoCategoria === 'despesa' ? 'variavel' : 'parcelada', label: 'Parcelada' },
    ] },
    {
      key: 'categoria', tipo: 'select', label: 'Categoria', todasLabel: 'Todas', disabled: categoriasErro,
      opcoes: categorias.map((c) => ({ value: c.nome, label: c.nome })),
    },
    { key: 'parcela', tipo: 'numero', label: 'Parcela', placeholder: 'Nº', span2: true },
    ...CAMPOS_PERIODO,
  ]

  return <FiltrosBarra campos={campos} onFiltrar={onFiltrar} />
}
