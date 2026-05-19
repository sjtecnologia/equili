import { useState } from 'react'
import { Trash2, CheckCircle, Lock, Pencil, AlertTriangle, CalendarClock, History } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'
import { useDividas } from '@/hooks/useDividas'
import type { Divida } from '@/types/financeiro'
import { DividaModal, EditarDividaModal, PagarParcelaModal, HistoricoPagamentosModal } from './DividaModals'


export default function DividasPage() {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Divida | null>(null)
  const [pagando, setPagando] = useState<Divida | null>(null)
  const [historico, setHistorico] = useState<Divida | null>(null)

  const { data: dividas = [], isLoading, contasFixasAtrasadas, deletar: deleteMutation, invalidate } = useDividas()

  const dividasAtivas = dividas.filter((d) => !d.quitada)
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
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <PageHeader
        title="Dívidas"
        subtitle={`${dividasAtivas.length} dívida(s) ativa(s)`}
        action={{ label: 'Adicionar', onClick: () => setShowModal(true), disabled: isLoading }}
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
        <p className="text-2xl font-bold text-danger-500">{formatCurrency(totalDevido)}</p>
      </div>

      {/* Banner de parcelas atrasadas */}
      {parcelasAtrasadasTotal > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {parcelasAtrasadasTotal === 1
                ? '1 parcela em atraso'
                : `${parcelasAtrasadasTotal} parcelas em atraso`}
              {dividasComAtraso > 1 ? ` em ${dividasComAtraso} dívidas` : ''}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Total em aberto: <strong>{formatCurrency(valorAtrasado)}</strong> — registre os pagamentos e informe a data correta de cada parcela.
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
            <div key={conta.descricao} className="card p-4 border border-amber-200 bg-amber-50/30 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{conta.descricao}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {conta.meses_atrasados} {conta.meses_atrasados === 1 ? 'mês em atraso' : 'meses em atraso'}
                  {' · '} desde {formatDate(conta.primeira_data)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-amber-600">{formatCurrency(conta.total)}</p>
                <a href="/contas-pagar" className="text-xs text-primary-500 hover:underline">Ver contas</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <SkeletonList count={3} height="h-24" />
      ) : dividasAtivas.length === 0 ? (
        <EmptyState icon={CheckCircle} title="Nenhuma dívida ativa!" description="Parabéns pelo equilíbrio financeiro." />
      ) : (
        <div className="space-y-3">
          {dividasAtivas.map((divida) => {
            const restante = divida.valor_parcela * divida.parcelas_restantes
            const progresso =
              divida.valor_total > 0
                ? Math.min(100, ((divida.valor_total - restante) / divida.valor_total) * 100)
                : 0
            const atrasadas = divida.parcelas_atrasadas

            return (
              <div key={divida.id} className={`card p-4 space-y-3 ${atrasadas > 0 ? 'border border-red-200' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate">{divida.descricao}</p>
                      {atrasadas > 0 && (
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
                    <p className="text-xs text-gray-500">
                      {divida.parcelas_totais
                        ? `${divida.parcelas_restantes} de ${divida.parcelas_totais} parcelas restantes · ${formatCurrency(divida.valor_parcela)}/mês`
                        : `${divida.parcelas_restantes} parcela(s) restante(s) · ${formatCurrency(divida.valor_parcela)}/mês`
                      }
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-danger-500">
                      {formatCurrency(restante)}
                    </p>
                    {divida.taxa_juros_mensal && divida.taxa_juros_mensal > 0 && (
                      <p className="text-xs text-gray-400">{divida.taxa_juros_mensal}% a.m.</p>
                    )}
                  </div>
                </div>

                {/* Barra de progresso */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{Math.round(progresso)}% pago</span>
                    <span>{formatCurrency(divida.valor_total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagando(divida)}
                    className="btn-secondary text-xs flex-1"
                  >
                    Registrar pagamento
                  </button>
                  <button
                    onClick={() => setHistorico(divida)}
                    className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                    aria-label="Histórico de pagamentos"
                  >
                    <History size={16} />
                  </button>
                  <button
                    onClick={() => setEditando(divida)}
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

      {showModal && <DividaModal onClose={() => setShowModal(false)} onSuccess={invalidate} />}
      {editando && (
        <EditarDividaModal
          divida={editando}
          onClose={() => setEditando(null)}
          onSuccess={invalidate}
        />
      )}
      {pagando && (
        <PagarParcelaModal
          divida={pagando}
          onClose={() => setPagando(null)}
          onSuccess={() => {
            invalidate()
            setPagando(null)
          }}
        />
      )}
      {historico && (
        <HistoricoPagamentosModal
          divida={historico}
          onClose={() => setHistorico(null)}
        />
      )}
    </div>
  )
}
