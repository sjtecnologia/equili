import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Pencil, Trash2, Loader2, PieChart } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FiltrosBarra, limparFiltrosVazios, type CampoFiltro } from '@/components/shared/FiltrosBarra'
import { useInvestimentos } from '@/hooks/useInvestimentos'
import type { Investimento } from '@/types/financeiro'
import { InvestimentoModal, TIPO_LABELS, TIPO_COLORS } from './InvestimentoModal'

const CAMPOS_FILTRO: CampoFiltro[] = [
  { key: 'q', tipo: 'busca', placeholder: 'Buscar (nome ou instituição)' },
  {
    key: 'tipo', tipo: 'select', label: 'Tipo', span2: true,
    opcoes: Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label })),
  },
  { key: 'data_inicio', tipo: 'data', label: 'Aplicação de' },
  { key: 'data_fim', tipo: 'data', label: 'Aplicação até' },
]

function brl(v: number) {
  return formatCurrency(v)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestimentosPage() {
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Investimento | null>(null)
  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const temFiltro = Object.keys(filtros).length > 0

  const { lista, resumo, isLoading, deletar } = useInvestimentos(filtros)

  const abrirEdicao = (inv: Investimento) => {
    setEditando(inv)
    setModal(true)
  }

  const fecharModal = () => {
    setModal(false)
    setEditando(null)
  }

  const rentPos = (resumo?.rentabilidade_pct ?? 0) >= 0
  const tiposOrdenados = useMemo(
    () => Object.entries(resumo?.por_tipo ?? {}).sort(([, a], [, b]) => b - a),
    [resumo?.por_tipo]
  )

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Investimentos"
        subtitle="Acompanhe sua carteira"
        action={{ label: 'Adicionar', onClick: () => { setEditando(null); setModal(true) } }}
      />

      {/* Cards de resumo */}
      {resumo && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Total investido</p>
            <p className="text-lg font-bold text-gray-800">{brl(resumo.total_investido)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Valor atual</p>
            <p className="text-lg font-bold text-gray-800">{brl(resumo.total_atual)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Rentabilidade</p>
            <div className="flex items-center gap-1">
              {rentPos ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-red-500" />}
              <p className={`text-lg font-bold ${rentPos ? 'text-green-600' : 'text-red-500'}`}>
                {rentPos ? '+' : ''}{resumo.rentabilidade_pct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Distribuição por tipo */}
      {resumo && Object.keys(resumo.por_tipo).length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={16} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-700">Distribuição por tipo</h2>
          </div>
          <div className="space-y-2">
            {tiposOrdenados.map(([tipo, valor]) => {
                const pct = resumo.total_atual > 0 ? (valor / resumo.total_atual) * 100 : 0
                return (
                  <div key={tipo}>
                    <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                      <span>{TIPO_LABELS[tipo] ?? tipo}</span>
                      <span>{brl(valor)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Filtros (a carteira acima continua sendo o total, sem filtro) */}
      <FiltrosBarra campos={CAMPOS_FILTRO} onFiltrar={(f) => setFiltros(limparFiltrosVazios(f))} />

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-indigo-500" size={24} />
        </div>
      ) : lista.length === 0 && temFiltro ? (
        <EmptyState icon={TrendingUp} title="Nenhum investimento encontrado para os filtros informados." />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhum investimento cadastrado ainda."
          description="Adicione suas posições para acompanhar sua carteira."
          action={{ label: 'Adicionar investimento', onClick: () => { setEditando(null); setModal(true) } }}
        />
      ) : (
        <div className="space-y-3">
          {lista.map((inv) => {
            const pos = inv.rentabilidade_pct >= 0
            return (
              <div key={inv.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 truncate">{inv.nome}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[inv.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TIPO_LABELS[inv.tipo] ?? inv.tipo}
                      </span>
                    </div>
                    {inv.instituicao && <p className="text-xs text-gray-400 mt-0.5">{inv.instituicao}</p>}
                    <div className="flex gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">Investido</span>
                        <p className="font-medium text-gray-700">{brl(inv.valor_investido)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Atual</span>
                        <p className="font-medium text-gray-700">{brl(inv.valor_atual)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Rentabilidade</span>
                        <p className={`font-semibold ${pos ? 'text-green-600' : 'text-red-500'}`}>
                          {pos ? '+' : ''}{inv.rentabilidade_pct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => abrirEdicao(inv)} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => { if (confirm('Remover este investimento?')) deletar.mutate(inv.id) }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && <InvestimentoModal onClose={fecharModal} editando={editando} />}
    </div>
  )
}
