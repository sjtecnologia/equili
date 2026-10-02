import { useReducer, useState } from 'react'
import { Trash2, CheckCircle, Lock, Pencil, AlertTriangle, CalendarClock, History } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'
import { useDividas } from '@/hooks/useDividas'
import { FiltrosBarra, limparFiltrosVazios, CAMPOS_PERIODO, type CampoFiltro } from '@/components/shared/FiltrosBarra'
import { gerarAgendaParcelas } from '@/lib/parcelas'
import type { Divida } from '@/types/financeiro'
import { DividaModal, EditarDividaModal, PagarParcelaModal, HistoricoPagamentosModal } from './DividaModals'

type ModalState = {
  showCreate: boolean
  editando: Divida | null
  pagando: Divida | null
  historico: Divida | null
}

type ModalAction =
  | { type: 'OPEN_CREATE' }
  | { type: 'CLOSE_CREATE' }
  | { type: 'OPEN_EDIT'; divida: Divida }
  | { type: 'CLOSE_EDIT' }
  | { type: 'OPEN_PAY'; divida: Divida }
  | { type: 'CLOSE_PAY' }
  | { type: 'OPEN_HISTORY'; divida: Divida }
  | { type: 'CLOSE_HISTORY' }

const initialModalState: ModalState = {
  showCreate: false,
  editando: null,
  pagando: null,
  historico: null,
}

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_CREATE':
      return { ...state, showCreate: true }
    case 'CLOSE_CREATE':
      return { ...state, showCreate: false }
    case 'OPEN_EDIT':
      return { ...state, editando: action.divida }
    case 'CLOSE_EDIT':
      return { ...state, editando: null }
    case 'OPEN_PAY':
      return { ...state, pagando: action.divida }
    case 'CLOSE_PAY':
      return { ...state, pagando: null }
    case 'OPEN_HISTORY':
      return { ...state, historico: action.divida }
    case 'CLOSE_HISTORY':
      return { ...state, historico: null }
    default:
      return state
  }
}


const CAMPOS_FILTRO: CampoFiltro[] = [
  { key: 'q', tipo: 'busca', placeholder: 'Buscar (descrição ou credor)' },
  {
    key: 'status', tipo: 'select', label: 'Status', span2: true,
    opcoes: [{ value: 'ativas', label: 'Ativas' }, { value: 'quitadas', label: 'Quitadas' }],
  },
  ...CAMPOS_PERIODO.map((c) => ({ ...c, label: c.key === 'data_inicio' ? 'Vencimento de' : 'Vencimento até' }) as CampoFiltro),
]

export default function DividasPage() {
  const [modals, dispatchModal] = useReducer(modalReducer, initialModalState)
  const [parcelasVisiveis, setParcelasVisiveis] = useState<Record<string, boolean>>({})

  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const temFiltro = Object.keys(filtros).length > 0

  const { data: dividas = [], todas, isLoading, contasFixasAtrasadas, deletar: deleteMutation } = useDividas(filtros)

  // Resumo, banner de atraso e limite do plano consideram todas as dívidas, não só as filtradas
  const dividasAtivas = todas.filter((d) => !d.quitada)
  const totalDevido = dividasAtivas.reduce(
    (acc, d) => acc + d.valor_parcela * d.parcelas_restantes,
    0
  )
  const atingiuLimite = dividasAtivas.length >= 3

  // Parcelas em atraso — calculado pelo backend via histórico de pagamentos
  const dividasComAtraso = dividasAtivas.filter((d) => d.parcelas_atrasadas > 0).length
  const parcelasAtrasadasTotal = dividasAtivas.reduce((acc, d) => acc + d.parcelas_atrasadas, 0)
  const valorAtrasado = dividasAtivas.reduce(
    (acc, d) => acc + d.parcelas_atrasadas * d.valor_parcela,
    0
  )

  return (
    <div className="w-full max-w-2xl box-border overflow-x-hidden p-4 space-y-4 mx-auto">
      <PageHeader
        title="Dívidas"
        subtitle={`${dividasAtivas.length} dívida(s) ativa(s)`}
        action={{ label: 'Adicionar', onClick: () => dispatchModal({ type: 'OPEN_CREATE' }), disabled: isLoading }}
      />

      {/* Limite freemium */}
      {atingiuLimite && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          <Lock size={16} className="text-accent-500 shrink-0 mt-0.5" />
          <span className="text-gray-700">
            Você atingiu o limite de <strong>3 dívidas</strong> no plano gratuito.{' '}
            <a href="#" className="text-primary-500 font-medium hover:underline">
              Fazer upgrade
            </a>{' '}
            para adicionar mais.
          </span>
        </div>
      )}

      {/* Total */}
      <div className="card p-4">
        <p className="text-sm text-gray-500">Total em dívidas</p>
        <p className="text-2xl font-bold text-danger-500 whitespace-nowrap tabular-nums">{formatCurrency(totalDevido)}</p>
      </div>

      {/* Banner de parcelas atrasadas */}
      {parcelasAtrasadasTotal > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="min-w-0 max-w-full">
            <p className="text-sm font-semibold text-red-700">
              {parcelasAtrasadasTotal === 1
                ? '1 parcela em atraso'
                : `${parcelasAtrasadasTotal} parcelas em atraso`}
              {dividasComAtraso > 1 ? ` em ${dividasComAtraso} dívidas` : ''}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Total em aberto: <strong className="whitespace-nowrap tabular-nums">{formatCurrency(valorAtrasado)}</strong> — registre os pagamentos e informe a data correta de cada parcela.
            </p>
          </div>
        </div>
      )}

      {/* Contas Fixas em Atraso */}
      {contasFixasAtrasadas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700">Contas Fixas em Atraso</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {contasFixasAtrasadas.length} conta{contasFixasAtrasadas.length > 1 ? 's' : ''}
            </span>
          </div>
          {contasFixasAtrasadas.map((conta) => (
            <div key={conta.descricao} className="card w-full max-w-full box-border overflow-x-hidden p-4 border border-amber-200 bg-amber-50/30 flex items-start justify-between flex-wrap gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{conta.descricao}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {conta.meses_atrasados} {conta.meses_atrasados === 1 ? 'mês em atraso' : 'meses em atraso'}
                  {' · '} desde {formatDate(conta.primeira_data)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-amber-600 whitespace-nowrap tabular-nums">{formatCurrency(conta.total)}</p>
                <a href="/contas-pagar" className="text-xs text-primary-500 hover:underline">Ver contas</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <FiltrosBarra campos={CAMPOS_FILTRO} onFiltrar={(f) => setFiltros(limparFiltrosVazios(f))} />

      {/* Lista */}
      {isLoading ? (
        <SkeletonList count={3} height="h-24" />
      ) : dividas.length === 0 && temFiltro ? (
        <EmptyState icon={CheckCircle} title="Nenhuma dívida encontrada para os filtros informados." />
      ) : dividas.length === 0 ? (
        <EmptyState icon={CheckCircle} title="Nenhuma dívida cadastrada" description="Adicione uma dívida para acompanhar suas parcelas." />
      ) : (
        <div className="w-full max-w-full box-border overflow-x-hidden space-y-3">
          {dividas.map((divida) => {
            const restante = divida.valor_parcela * divida.parcelas_restantes
            const progresso =
              divida.valor_total > 0
                ? Math.min(100, ((divida.valor_total - restante) / divida.valor_total) * 100)
                : 0
            const atrasadas = divida.parcelas_atrasadas
            const agendaParcelas = gerarAgendaParcelas(divida)
            const mostrarParcelas = parcelasVisiveis[divida.id]

            return (
              <div key={divida.id} className={`card w-full max-w-full box-border overflow-x-hidden p-4 space-y-3 ${atrasadas > 0 ? 'border border-red-200' : ''}`}>
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate">{divida.descricao}</p>
                      {divida.quitada && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Quitada
                        </span>
                      )}
                      {atrasadas > 0 && !divida.quitada && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          <AlertTriangle size={10} />
                          {atrasadas} {atrasadas === 1 ? 'atrasada' : 'atrasadas'}
                        </span>
                      )}
                    </div>
                    {divida.credor && (
                      <p className="text-xs text-gray-400 truncate">{divida.credor}</p>
                    )}
                    <p className={`text-xs mt-0.5 ${atrasadas > 0 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {atrasadas > 0
                        ? `Venceu em: ${formatDate(divida.data_primeira_atrasada ?? divida.data_prox_vencimento)}`
                        : `Próx. vencimento: ${formatDate(divida.data_prox_vencimento)}`}
                    </p>
                    <p className="text-xs text-gray-500 flex flex-wrap gap-2">
                      {divida.parcelas_totais
                        ? `${divida.parcelas_restantes} de ${divida.parcelas_totais} parcelas restantes · ${formatCurrency(divida.valor_parcela)}/mês`
                        : `${divida.parcelas_restantes} parcela(s) restante(s) · ${formatCurrency(divida.valor_parcela)}/mês`
                      }
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-danger-500 whitespace-nowrap tabular-nums">
                      {formatCurrency(restante)}
                    </p>
                    {divida.taxa_juros_mensal && divida.taxa_juros_mensal > 0 && (
                      <p className="text-xs text-gray-400">{divida.taxa_juros_mensal}% a.m.</p>
                    )}
                  </div>
                </div>

                {/* Barra de progresso */}
                <div>
                  <div className="flex justify-between flex-wrap gap-2 text-xs text-gray-400 mb-1">
                    <span>{Math.round(progresso)}% pago</span>
                    <span className="whitespace-nowrap tabular-nums">{formatCurrency(divida.valor_total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() =>
                      setParcelasVisiveis((prev) => ({ ...prev, [divida.id]: !prev[divida.id] }))
                    }
                    className="text-xs font-medium text-primary-500 hover:underline"
                  >
                    Ver parcelas
                  </button>

                  {mostrarParcelas && (
                    <div className="max-h-[320px] overflow-y-auto">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                        {agendaParcelas.map((parcela) => (
                          <span key={parcela.numero}>
                            Nº {parcela.numero} — {parcela.vencimento.toLocaleDateString('pt-BR')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <button
                    onClick={() => dispatchModal({ type: 'OPEN_PAY', divida })}
                    disabled={divida.quitada}
                    className="btn-secondary text-xs flex-1 disabled:opacity-50"
                  >
                    Registrar pagamento
                  </button>
                  <button
                    onClick={() => dispatchModal({ type: 'OPEN_HISTORY', divida })}
                    className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                    aria-label="Histórico de pagamentos"
                  >
                    <History size={16} />
                  </button>
                  <button
                    onClick={() => dispatchModal({ type: 'OPEN_EDIT', divida })}
                    className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                    aria-label="Editar dívida"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(divida.id)}
                    disabled={deleteMutation.isPending}
                    className="text-gray-300 hover:text-danger-500 transition-colors p-1"
                    aria-label="Excluir dívida"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modals.showCreate && <DividaModal onClose={() => dispatchModal({ type: 'CLOSE_CREATE' })} />}
      {modals.editando && (
        <EditarDividaModal
          divida={modals.editando}
          onClose={() => dispatchModal({ type: 'CLOSE_EDIT' })}
        />
      )}
      {modals.pagando && (
        <PagarParcelaModal
          divida={modals.pagando}
          onClose={() => dispatchModal({ type: 'CLOSE_PAY' })}
        />
      )}
      {modals.historico && (
        <HistoricoPagamentosModal
          divida={modals.historico}
          onClose={() => dispatchModal({ type: 'CLOSE_HISTORY' })}
        />
      )}
    </div>
  )
}
