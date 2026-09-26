import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Pencil, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'
import { useRendas } from '@/hooks/useRendas'
import type { Renda } from '@/types/financeiro'
import { RendaModal, FREQUENCIAS, TIPOS } from './RendaModal'

export default function RendaPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Renda | null>(null)

  const { data: rendas = [], isLoading, deletar: deleteMutation } = useRendas()

  const total = rendas.reduce((acc, r) => acc + r.valor, 0)

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <PageHeader
        title="Renda"
        subtitle="Suas fontes de renda"
        action={{ label: 'Adicionar', onClick: () => setShowModal(true) }}
      />

      {/* Total */}
      <div className="card bg-success-500 bg-opacity-10 border border-green-200 p-4">
        <p className="text-sm text-gray-600">Total mensal</p>
        <p className="text-2xl font-bold text-success-500">{formatCurrency(total)}</p>
      </div>

      {/* Lista */}
      {isLoading ? (
        <SkeletonList count={3} />
      ) : rendas.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhuma renda cadastrada."
          action={{ label: 'Adicionar primeira renda', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="space-y-3">
          {rendas.map((renda) => (
            <div key={renda.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{renda.descricao}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {TIPOS.find((t) => t.value === renda.tipo)?.label ?? renda.tipo}
                  {' · '}
                  {FREQUENCIAS.find((f) => f.value === renda.frequencia)?.label ?? renda.frequencia}
                </p>
              </div>
              <p className="font-bold text-success-500 whitespace-nowrap">
                {formatCurrency(renda.valor)}
              </p>
              <button
                onClick={() => setEditando(renda)}
                className="text-gray-300 hover:text-primary-500 transition-colors"
                aria-label="Editar renda"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => deleteMutation.mutate(renda.id)}
                disabled={deleteMutation.isPending}
                className="text-gray-300 hover:text-danger-500 transition-colors"
                aria-label="Excluir renda"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RendaModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['rendas'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      )}
      {editando && (
        <RendaModal
          renda={editando}
          onClose={() => setEditando(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['rendas'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      )}
    </div>
  )
}
