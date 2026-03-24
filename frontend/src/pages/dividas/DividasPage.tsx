import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, X, CheckCircle, Lock } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'

interface Divida {
  id: string
  credor: string
  valor_total: number
  valor_pago: number
  taxa_juros: number
  data_vencimento: string | null
  quitada: boolean
  parcelas_restantes: number | null
}

interface LimiteError {
  response?: { status: number; data?: { detail?: string } }
}

const schema = z.object({
  credor: z.string().min(1, 'Nome do credor obrigatório'),
  valor_total: z.coerce.number().positive('Valor deve ser positivo'),
  taxa_juros: z.coerce.number().min(0, 'Taxa não pode ser negativa'),
  data_vencimento: z.string().optional(),
  parcelas_restantes: z.coerce.number().int().min(1).optional().nullable(),
})

type FormData = z.infer<typeof schema>

function DividaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { taxa_juros: 0 } })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      await api.post('/dividas', data)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const e = err as LimiteError
      if (e.response?.status === 403) {
        setServerError(
          'Você atingiu o limite de 3 dívidas no plano gratuito. Faça upgrade para adicionar mais.'
        )
      } else {
        setServerError('Erro ao salvar dívida.')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">Nova dívida</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credor</label>
            <input
              type="text"
              className={`input-field ${errors.credor ? 'border-danger-500' : ''}`}
              placeholder="Ex.: Banco, Cartão, Empréstimo..."
              {...register('credor')}
            />
            {errors.credor && <p className="mt-1 text-xs text-danger-500">{errors.credor.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor total (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={`input-field ${errors.valor_total ? 'border-danger-500' : ''}`}
                placeholder="0,00"
                {...register('valor_total')}
              />
              {errors.valor_total && (
                <p className="mt-1 text-xs text-danger-500">{errors.valor_total.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Juros % a.m.</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                placeholder="0,00"
                {...register('taxa_juros')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas restantes</label>
              <input
                type="number"
                min="1"
                className="input-field"
                placeholder="—"
                {...register('parcelas_restantes')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
              <input type="date" className="input-field" {...register('data_vencimento')} />
            </div>
          </div>
          {serverError && (
            <div className="rounded-lg bg-danger-100 border border-danger-200 px-3 py-2 text-sm text-danger-500">
              {serverError}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DividasPage() {
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: dividas = [], isLoading } = useQuery<Divida[]>({
    queryKey: ['dividas'],
    queryFn: () => api.get('/dividas').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/dividas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dividas'] }),
  })

  const pagarParcelaMutation = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) =>
      api.post(`/dividas/${id}/pagar-parcela`, { valor }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dividas'] }),
  })

  const dividasAtivas = dividas.filter((d) => !d.quitada)
  const totalDevido = dividasAtivas.reduce((acc, d) => acc + (d.valor_total - d.valor_pago), 0)
  const atingiuLimite = dividasAtivas.length >= 3

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dividas'] })

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dívidas</h1>
          <p className="text-sm text-gray-500">{dividasAtivas.length} dívida(s) ativa(s)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={isLoading}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Adicionar</span>
        </button>
      </div>

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

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : dividasAtivas.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle size={32} className="text-success-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-700">Nenhuma dívida ativa!</p>
          <p className="text-gray-500 text-sm mt-1">Parabéns pelo equilíbrio financeiro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dividasAtivas.map((divida) => {
            const progresso =
              divida.valor_total > 0 ? (divida.valor_pago / divida.valor_total) * 100 : 0

            return (
              <div key={divida.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{divida.credor}</p>
                    {divida.data_vencimento && (
                      <p className="text-xs text-gray-500">
                        Vence em {formatDate(divida.data_vencimento)}
                      </p>
                    )}
                    {divida.parcelas_restantes && (
                      <p className="text-xs text-gray-500">
                        {divida.parcelas_restantes} parcelas restantes
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-danger-500">
                      {formatCurrency(divida.valor_total - divida.valor_pago)}
                    </p>
                    {divida.taxa_juros > 0 && (
                      <p className="text-xs text-gray-400">{divida.taxa_juros}% a.m.</p>
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
                    onClick={() =>
                      pagarParcelaMutation.mutate({ id: divida.id, valor: 0 })
                    }
                    disabled={pagarParcelaMutation.isPending}
                    className="btn-secondary text-xs flex-1"
                  >
                    Registrar pagamento
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
    </div>
  )
}
