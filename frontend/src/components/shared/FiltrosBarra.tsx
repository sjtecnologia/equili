import { useState } from 'react'
import { Search } from 'lucide-react'

export type CampoFiltro =
  | { key: string; tipo: 'busca'; placeholder: string }
  | {
      key: string
      tipo: 'select'
      label: string
      opcoes: { value: string; label: string }[]
      todasLabel?: string
      disabled?: boolean
      span2?: boolean
    }
  | { key: string; tipo: 'data' | 'numero'; label: string; placeholder?: string; step?: string; span2?: boolean }

export type Filtros = Record<string, string>

/** Remove campos vazios; o resultado vai direto como query params do GET. */
export function limparFiltrosVazios<T extends object>(f: T): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return out
}

interface Props {
  campos: CampoFiltro[]
  onFiltrar: (filtros: Filtros) => void
}

/** Barra de filtros padrão (visual das telas de Contas): busca em largura total + grade de 2 colunas. */
export function FiltrosBarra({ campos, onFiltrar }: Props) {
  const [draft, setDraft] = useState<Filtros>({})
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))

  const limpar = () => {
    setDraft({})
    onFiltrar({})
  }

  const busca = campos.find((c) => c.tipo === 'busca')
  const demais = campos.filter((c): c is Exclude<CampoFiltro, { tipo: 'busca' }> => c.tipo !== 'busca')

  return (
    <form
      className="card p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        onFiltrar(limparFiltrosVazios(draft))
      }}
    >
      {busca && busca.tipo === 'busca' && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder={busca.placeholder}
            aria-label={busca.placeholder}
            value={draft[busca.key] ?? ''}
            onChange={(e) => set(busca.key, e.target.value)}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {demais.map((c) => {
          const span = c.span2 ? 'col-span-2' : ''
          return (
            <label key={c.key} className={`text-xs text-gray-500 space-y-1 ${span}`}>
              {c.label}
              {c.tipo === 'select' ? (
                <select
                  className="input-field text-sm"
                  disabled={c.disabled}
                  value={draft[c.key] ?? ''}
                  onChange={(e) => set(c.key, e.target.value)}
                >
                  <option value="">{c.todasLabel ?? 'Todos'}</option>
                  {c.opcoes.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={c.tipo === 'data' ? 'date' : 'number'}
                  min={c.tipo === 'numero' ? 0 : undefined}
                  step={c.tipo === 'numero' ? c.step : undefined}
                  className="input-field text-sm"
                  placeholder={c.placeholder}
                  value={draft[c.key] ?? ''}
                  onChange={(e) => set(c.key, e.target.value)}
                />
              )}
            </label>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm flex-1">Filtrar</button>
        <button type="button" onClick={limpar} className="btn-secondary text-sm flex-1">Limpar</button>
      </div>
    </form>
  )
}

export const CAMPOS_PERIODO: CampoFiltro[] = [
  { key: 'data_inicio', tipo: 'data', label: 'De' },
  { key: 'data_fim', tipo: 'data', label: 'Até' },
]
