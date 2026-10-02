import { useState } from 'react'
import { Search } from 'lucide-react'
import { useCategoriasAtivas } from '@/hooks/useCategoriasAtivas'

export interface ContasFiltros {
  q?: string
  status?: string
  categoria?: string
  parcela?: string
  data_inicio?: string
  data_fim?: string
}

interface Props {
  statusOptions: { value: string; label: string }[]
  tipoCategoria: 'despesa' | 'receita'
  onFiltrar: (filtros: ContasFiltros) => void
}

export function limparFiltrosVazios(f: ContasFiltros): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(f)) {
    if (v && v.trim()) out[k] = v.trim()
  }
  return out
}

export function ContasFiltrosBar({ statusOptions, tipoCategoria, onFiltrar }: Props) {
  const [draft, setDraft] = useState<ContasFiltros>({})
  const { data: categorias = [], isError: categoriasErro } = useCategoriasAtivas(tipoCategoria)

  const set = (k: keyof ContasFiltros, v: string) => setDraft((d) => ({ ...d, [k]: v }))

  const limpar = () => {
    setDraft({})
    onFiltrar({})
  }

  return (
    <form
      className="card p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        onFiltrar(draft)
      }}
    >
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          className="input-field pl-9"
          placeholder="Buscar (descrição ou parcela)"
          aria-label="Buscar (descrição ou parcela)"
          value={draft.q ?? ''}
          onChange={(e) => set('q', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 space-y-1">
          Status
          <select
            className="input-field text-sm"
            value={draft.status ?? ''}
            onChange={(e) => set('status', e.target.value)}
          >
            <option value="">Todos</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500 space-y-1">
          Categoria
          <select
            className="input-field text-sm"
            disabled={categoriasErro}
            value={draft.categoria ?? ''}
            onChange={(e) => set('categoria', e.target.value)}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500 space-y-1 col-span-2">
          Parcela
          <input
            type="number"
            min={1}
            className="input-field text-sm"
            placeholder="Nº"
            value={draft.parcela ?? ''}
            onChange={(e) => set('parcela', e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500 space-y-1">
          De
          <input
            type="date"
            className="input-field text-sm"
            value={draft.data_inicio ?? ''}
            onChange={(e) => set('data_inicio', e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500 space-y-1">
          Até
          <input
            type="date"
            className="input-field text-sm"
            value={draft.data_fim ?? ''}
            onChange={(e) => set('data_fim', e.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm flex-1">Filtrar</button>
        <button type="button" onClick={limpar} className="btn-secondary text-sm flex-1">Limpar</button>
      </div>
    </form>
  )
}
