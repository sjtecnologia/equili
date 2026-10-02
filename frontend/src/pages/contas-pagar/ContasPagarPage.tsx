import { useMemo, useReducer, useState } from 'react'
import { Trash2, CheckCircle2, AlertCircle, RefreshCw, Layers, Pencil } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'
import { ContasFiltrosBar, limparFiltrosVazios } from '@/components/shared/ContasFiltrosBar'
import { useContasPagar } from '@/hooks/useContasPagar'
import type { ContaAPagar } from '@/types/financeiro'
import { CATEGORIAS, EditarContaModal, PagarContaModal, ContaModal } from './ContaPagarModals'

type ModalState = {
  showCreate: boolean
  editando: ContaAPagar | null
  pagando: ContaAPagar | null
}

type ModalAction =
  | { type: 'OPEN_CREATE' }
  | { type: 'CLOSE_CREATE' }
  | { type: 'OPEN_EDIT'; conta: ContaAPagar }
  | { type: 'CLOSE_EDIT' }
  | { type: 'OPEN_PAY'; conta: ContaAPagar }
  | { type: 'CLOSE_PAY' }

const initialModalState: ModalState = {
  showCreate: false,
  editando: null,
  pagando: null,
}

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_CREATE':
      return { ...state, showCreate: true }
    case 'CLOSE_CREATE':
      return { ...state, showCreate: false }
    case 'OPEN_EDIT':
      return { ...state, editando: action.conta }
    case 'CLOSE_EDIT':
      return { ...state, editando: null }
    case 'OPEN_PAY':
      return { ...state, pagando: action.conta }
    case 'CLOSE_PAY':
      return { ...state, pagando: null }
    default:
      return state
  }
}

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  pendente: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  pago: { label: 'Pago', classes: 'bg-green-100 text-green-700' },
  vencido: { label: 'Vencido', classes: 'bg-red-100 text-red-700' },
}

export default function ContasPagarPage() {
  const [modals, dispatchModal] = useReducer(modalReducer, initialModalState)
  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const temFiltro = Object.keys(filtros).length > 0

  const { data: contas = [], isLoading, deletar: deleteMutation, pagar: pagarMutation } = useContasPagar(filtros)
  const contasFiltradas = contas

  const { totalPendente, totalPago } = useMemo(() => ({
    totalPendente: contas.filter((c) => c.status !== 'pago').reduce((acc, c) => acc + c.valor, 0),
    totalPago: contas.filter((c) => c.status === 'pago').reduce((acc, c) => acc + c.valor, 0),
  }), [contas])

  return (
    <div className="w-full max-w-2xl box-border overflow-x-hidden p-4 space-y-4 mx-auto">
      <PageHeader
        title="Contas a Pagar"
        subtitle={`${contas.filter((c) => c.status !== 'pago').length} conta(s) pendente(s)`}
        action={{ label: 'Adicionar', onClick: () => dispatchModal({ type: 'OPEN_CREATE' }) }}
      />

      {/* Resumo */}
      <div className="grid w-full max-w-full grid-cols-2 gap-3">
        <div className="card min-w-0 max-w-full box-border overflow-x-hidden p-4">
          <p className="text-xs text-gray-500 mb-1">A pagar</p>
          <p className="text-xl font-bold text-danger-500 whitespace-nowrap tabular-nums">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="card min-w-0 max-w-full box-border overflow-x-hidden p-4">
          <p className="text-xs text-gray-500 mb-1">Já pago</p>
          <p className="text-xl font-bold text-success-500 whitespace-nowrap tabular-nums">{formatCurrency(totalPago)}</p>
        </div>
      </div>

      {/* Filtros */}
      <ContasFiltrosBar
        tipoCategoria="despesa"
        statusOptions={Object.entries(STATUS_LABELS).map(([value, s]) => ({ value, label: s.label }))}
        onFiltrar={(f) => setFiltros(limparFiltrosVazios(f))}
      />

      {/* Lista */}
      {isLoading ? (
        <SkeletonList count={3} height="h-20" />
      ) : contasFiltradas.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={temFiltro ? 'Nenhuma conta encontrada para os filtros informados.' : 'Nenhuma conta cadastrada.'}
          action={!temFiltro ? { label: 'Adicionar primeira conta', onClick: () => dispatchModal({ type: 'OPEN_CREATE' }) } : undefined}
        />
      ) : (
        <div className="w-full max-w-full box-border overflow-x-hidden space-y-3">
          {contasFiltradas.map((conta) => {
            const statusInfo = STATUS_LABELS[conta.status]
            const isVencido = conta.status === 'vencido'
            return (
              <div
                key={conta.id}
                className={`card w-full max-w-full box-border overflow-x-hidden p-4 space-y-3 ${isVencido ? 'border border-red-200' : ''}`}
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">{conta.descricao}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.classes}`}>
                        {statusInfo.label}
                      </span>
                      {conta.tipo === 'fixa' && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                          <RefreshCw size={10} /> Recorrente
                        </span>
                      )}
                      {conta.tipo === 'variavel' && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                          <Layers size={10} /> Parcelada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {CATEGORIAS.find((c) => c.value === conta.categoria)?.label ?? conta.categoria}
                      {' · Venc. '}{formatDate(conta.data_vencimento)}
                    </p>
                    {isVencido && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <AlertCircle size={12} />
                        <span>Conta vencida</span>
                      </div>
                    )}
                  </div>
                  <p className="font-bold text-gray-800 whitespace-nowrap tabular-nums shrink-0">
                    {formatCurrency(conta.valor)}
                  </p>
                </div>

                {conta.observacao && (
                  <p className="text-xs text-gray-400 italic">{conta.observacao}</p>
                )}

                <div className="flex gap-2">
                  {conta.status !== 'pago' && (
                    <button
                      onClick={() => dispatchModal({ type: 'OPEN_PAY', conta })}
                      disabled={pagarMutation.isPending}
                      className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={12} />
                      Marcar como pago
                    </button>
                  )}
                  <button
                    onClick={() => dispatchModal({ type: 'OPEN_EDIT', conta })}
                    className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                    aria-label="Editar conta"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(conta.id)}
                    disabled={deleteMutation.isPending}
                    className="text-gray-300 hover:text-danger-500 transition-colors p-1 ml-auto"
                    aria-label="Excluir conta"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modals.showCreate && (
        <ContaModal
          onClose={() => dispatchModal({ type: 'CLOSE_CREATE' })}
        />
      )}
      {modals.editando && (
        <EditarContaModal
          conta={modals.editando}
          onClose={() => dispatchModal({ type: 'CLOSE_EDIT' })}
        />
      )}
      {modals.pagando && (
        <PagarContaModal
          conta={modals.pagando}
          onClose={() => dispatchModal({ type: 'CLOSE_PAY' })}
        />
      )}

    </div>
  )
}
