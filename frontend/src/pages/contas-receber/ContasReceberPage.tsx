import { useState, useMemo } from 'react'
import { Trash2, CheckCircle2, RefreshCw, Layers, Pencil } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'
import { useContasReceber } from '@/hooks/useContasReceber'
import type { ContaAReceber } from '@/types/financeiro'
import { notify } from '@/utils/notify'
import { ORIGENS, EditarContaReceberModal, ReceberContaModal, ContaModal } from './ContaReceberModals'

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  pendente: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  recebido: { label: 'Recebido', classes: 'bg-green-100 text-green-700' },
  atrasado: { label: 'Atrasado', classes: 'bg-red-100 text-red-700' },
}

export default function ContasReceberPage() {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<ContaAReceber | null>(null)
  const [recebendo, setRecebendo] = useState<ContaAReceber | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  const { data: contas = [], isLoading, deletar: deleteMutation, invalidate } = useContasReceber()

  const contasFiltradas = useMemo(
    () => filtroStatus === 'todos' ? contas : contas.filter((c) => c.status === filtroStatus),
    [contas, filtroStatus]
  )

  const { totalPendente, totalRecebido } = useMemo(() => ({
    totalPendente: contas.filter((c) => c.status !== 'recebido').reduce((acc, c) => acc + c.valor, 0),
    totalRecebido: contas.filter((c) => c.status === 'recebido').reduce((acc, c) => acc + c.valor, 0),
  }), [contas])

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <PageHeader
        title="Contas a Receber"
        subtitle={`${contas.filter((c) => c.status !== 'recebido').length} conta(s) pendente(s)`}
        action={{ label: 'Adicionar', onClick: () => setShowModal(true) }}
      />

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">A receber</p>
          <p className="text-xl font-bold text-success-500">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Já recebido</p>
          <p className="text-xl font-bold text-gray-700">{formatCurrency(totalRecebido)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['todos', 'pendente', 'atrasado', 'recebido'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltroStatus(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              filtroStatus === f
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-500'
            }`}
          >
            {f === 'todos' ? 'Todos' : STATUS_LABELS[f].label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <SkeletonList count={3} height="h-20" />
      ) : contasFiltradas.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={filtroStatus === 'todos' ? 'Nenhuma conta cadastrada.' : `Nenhuma conta ${STATUS_LABELS[filtroStatus]?.label.toLowerCase()}.`}
          action={filtroStatus === 'todos' ? { label: 'Adicionar primeira conta', onClick: () => setShowModal(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {contasFiltradas.map((conta) => {
            const statusInfo = STATUS_LABELS[conta.status]
            return (
              <div
                key={conta.id}
                className={`card p-4 space-y-3 ${conta.status === 'atrasado' ? 'border border-red-200' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">{conta.descricao}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.classes}`}>
                        {statusInfo.label}
                      </span>
                      {conta.tipo === 'recorrente' && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                          <RefreshCw size={10} /> Recorrente
                        </span>
                      )}
                      {conta.tipo === 'parcelada' && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                          <Layers size={10} /> Parcelada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ORIGENS.find((o) => o.value === conta.origem)?.label ?? conta.origem}
                      {conta.devedor ? ` · ${conta.devedor}` : ''}
                      {' · Previsto em '}{formatDate(conta.data_prevista)}
                    </p>
                  </div>
                  <p className="font-bold text-success-500 whitespace-nowrap shrink-0">
                    {formatCurrency(conta.valor)}
                  </p>
                </div>

                {conta.observacao && (
                  <p className="text-xs text-gray-400 italic">{conta.observacao}</p>
                )}

                <div className="flex gap-2">
                  {conta.status !== 'recebido' && (
                    <button
                      onClick={() => setRecebendo(conta)}
                      className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={12} />
                      Marcar como recebido
                    </button>
                  )}
                  <button
                    onClick={() => setEditando(conta)}
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

      {showModal && (
        <ContaModal
          onClose={() => setShowModal(false)}
          onSuccess={(count) => {
            invalidate()
            if (count > 1) {
              notify.success(`${count} lançamentos criados com sucesso!`)
            }
          }}
        />
      )}
      {editando && (
        <EditarContaReceberModal
          conta={editando}
          onClose={() => setEditando(null)}
          onSuccess={invalidate}
        />
      )}
      {recebendo && (
        <ReceberContaModal
          conta={recebendo}
          onClose={() => setRecebendo(null)}
          onSuccess={invalidate}
        />
      )}

    </div>
  )
}
