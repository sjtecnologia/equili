import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Target, Lock, Pencil, TrendingUp, CheckCircle, RotateCcw, Trash2, Flag } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'
import { useMetas } from '@/hooks/useMetas'
import { usePlano } from '@/hooks/usePlano'
import { MetaForm, AportarModal } from './MetaModals'
import type { Meta } from '@/types/financeiro'

type ModalState =
  | { type: 'criar' }
  | { type: 'editar'; meta: Meta }
  | { type: 'aportar'; meta: Meta }
  | { type: 'nenhum' }

export default function MetasPage() {
  const [modal, setModal] = useState<ModalState>({ type: 'nenhum' })
  const { metas, total, ativas, isLoading, atualizar, excluir } = useMetas()
  const { rotulo, limite } = usePlano()

  const limiteMetas = limite('metas')
  const atingiuLimite = limiteMetas !== null && limiteMetas !== undefined && ativas >= limiteMetas

  function alternarConclusao(meta: Meta) {
    atualizar.mutate({ id: meta.id, payload: { concluida: !meta.concluida } })
  }

  function excluirComConfirmacao(meta: Meta) {
    if (window.confirm(`Excluir a meta "${meta.titulo}"?`)) {
      excluir.mutate(meta.id)
    }
  }

  return (
    <div className="w-full max-w-2xl box-border overflow-x-hidden p-4 space-y-4 mx-auto">
      <PageHeader
        title="Metas"
        subtitle={`${ativas} meta(s) ativa(s) · ${total - ativas} concluída(s)`}
        action={{
          label: 'Nova meta',
          onClick: () => setModal({ type: 'criar' }),
          disabled: isLoading || (atingiuLimite ?? false),
        }}
      />

      {/* Limite do plano */}
      {atingiuLimite && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          <Lock size={16} className="text-accent-500 shrink-0 mt-0.5" />
          <span className="text-gray-700">
            Você atingiu o limite de <strong>{limiteMetas} meta(s) ativa(s)</strong> no plano {rotulo}.{' '}
            <Link to="/planos" className="text-primary-500 font-medium hover:underline">
              Fazer upgrade
            </Link>{' '}
            ou conclua uma meta para criar outra.
          </span>
        </div>
      )}

      {isLoading ? (
        <SkeletonList count={3} />
      ) : metas.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta ainda"
          description="Crie um objetivo financeiro (ex.: reserva de emergência, viagem, entrada do imóvel) e acompanhe o progresso dos aportes."
          action={{
            label: 'Criar meta',
            onClick: () => setModal({ type: 'criar' }),
          }}
        />
      ) : (
        <div className="space-y-3">
          {metas.map((meta) => (
            <div
              key={meta.id}
              className={`bg-white border rounded-xl p-4 space-y-3 ${
                meta.concluida ? 'border-primary-200 opacity-75' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate flex items-center gap-2">
                    {meta.titulo}
                    {meta.concluida && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-full px-2 py-0.5">
                        <CheckCircle size={12} /> Concluída
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 space-x-2">
                    {meta.categoria && <span>🏷️ {meta.categoria}</span>}
                    {meta.prazo && (
                      <span className="inline-flex items-center gap-1">
                        <Flag size={12} /> até {formatDate(meta.prazo)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setModal({ type: 'aportar', meta })}
                    className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"
                    title="Registrar aporte"
                  >
                    <TrendingUp size={16} />
                  </button>
                  <button
                    onClick={() => setModal({ type: 'editar', meta })}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => alternarConclusao(meta)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title={meta.concluida ? 'Reabrir meta' : 'Concluir meta'}
                  >
                    {meta.concluida ? <RotateCcw size={16} /> : <CheckCircle size={16} />}
                  </button>
                  <button
                    onClick={() => excluirComConfirmacao(meta)}
                    className="p-1.5 text-danger-500 hover:bg-danger-50 rounded-lg"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    {formatCurrency(meta.valor_atual)}{' '}
                    <span className="text-gray-400">de {formatCurrency(meta.valor_alvo)}</span>
                  </span>
                  <span className="font-medium text-gray-700">{meta.percentual}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      meta.concluida ? 'bg-primary-500' : 'bg-accent-500'
                    }`}
                    style={{ width: `${meta.percentual}%` }}
                  />
                </div>
                {!meta.concluida && meta.restante > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Faltam {formatCurrency(meta.restante)} para concluir
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {modal.type === 'criar' && <MetaForm onClose={() => setModal({ type: 'nenhum' })} editing={null} />}
      {modal.type === 'editar' && (
        <MetaForm onClose={() => setModal({ type: 'nenhum' })} editing={modal.meta} />
      )}
      {modal.type === 'aportar' && (
        <AportarModal onClose={() => setModal({ type: 'nenhum' })} meta={modal.meta} />
      )}
    </div>
  )
}