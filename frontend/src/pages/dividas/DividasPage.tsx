import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, X, CheckCircle, Lock, Pencil, AlertTriangle, History } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

interface Divida {
  id: string
  descricao: string
  credor: string | null
  tipo: string
  valor_total: number
  valor_parcela: number
  parcelas_restantes: number
  taxa_juros_mensal: number | null
  data_prox_vencimento: string
  data_inicio_contrato: string | null
  data_primeira_parcela: string | null
  quitada: boolean
}

interface DividaPagamento {
  id: string
  data_referencia: string
  data_pagamento: string
  valor_pago: number
  valor_parcela_original: number
  observacao: string | null
}

interface LimiteError {
  response?: { status: number; data?: { detail?: string } }
}

const schema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  credor: z.string().optional(),
  tipo: z.string().min(1, 'Tipo obrigatório'),
  valor_total: z.coerce.number().positive('Valor deve ser positivo'),
  valor_parcela: z.coerce.number().positive('Valor da parcela deve ser positivo'),
  parcelas_restantes: z.coerce.number().int().min(1, 'Mínimo 1 parcela'),
  taxa_juros_mensal: z.coerce.number().min(0).optional().nullable(),
  data_inicio_contrato: z.string().optional(),
  data_primeira_parcela: z.string().min(1, 'Data da primeira parcela obrigatória'),
})

type FormData = z.infer<typeof schema>

// Formulário compartilhado entre criação e edição
function DividaForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  serverError,
  onClose,
  submitLabel,
}: {
  defaultValues?: Partial<FormData>
  onSubmit: (data: FormData) => Promise<void>
  isSubmitting: boolean
  serverError: string | null
  onClose: () => void
  submitLabel: string
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'emprestimo', taxa_juros_mensal: 0, ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
        <input
          type="text"
          className={`input-field ${errors.descricao ? 'border-danger-500' : ''}`}
          placeholder="Ex.: Financiamento do carro"
          {...register('descricao')}
        />
        {errors.descricao && (
          <p className="mt-1 text-xs text-danger-500">{errors.descricao.message}</p>
        )}
      </div>

      {/* Tipo + Credor */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
          <select
            className={`input-field ${errors.tipo ? 'border-danger-500' : ''}`}
            {...register('tipo')}
          >
            <option value="cartao_parcelado">Cartão parcelado</option>
            <option value="emprestimo">Empréstimo</option>
            <option value="financiamento">Financiamento</option>
            <option value="cheque_pre">Cheque pré</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Credor</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ex.: Nubank"
            {...register('credor')}
          />
        </div>
      </div>

      {/* Valor total + Valor parcela */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor total (R$) *</label>
          <Controller
            name="valor_total"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                {...field}
                className={`input-field ${errors.valor_total ? 'border-danger-500' : ''}`}
                placeholder="0,00"
              />
            )}
          />
          {errors.valor_total && (
            <p className="mt-1 text-xs text-danger-500">{errors.valor_total.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor parcela (R$) *</label>
          <Controller
            name="valor_parcela"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                {...field}
                className={`input-field ${errors.valor_parcela ? 'border-danger-500' : ''}`}
                placeholder="0,00"
              />
            )}
          />
          {errors.valor_parcela && (
            <p className="mt-1 text-xs text-danger-500">{errors.valor_parcela.message}</p>
          )}
        </div>
      </div>

      {/* Parcelas restantes + Juros */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas restantes *</label>
          <input
            type="number"
            min="1"
            className={`input-field ${errors.parcelas_restantes ? 'border-danger-500' : ''}`}
            placeholder="Ex.: 12"
            {...register('parcelas_restantes')}
          />
          {errors.parcelas_restantes && (
            <p className="mt-1 text-xs text-danger-500">{errors.parcelas_restantes.message}</p>
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
            {...register('taxa_juros_mensal')}
          />
        </div>
      </div>

      {/* Datas */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Datas do contrato
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Início do contrato
            </label>
            <input type="date" className="input-field" {...register('data_inicio_contrato')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              1ª parcela *
            </label>
            <input
              type="date"
              className={`input-field ${errors.data_primeira_parcela ? 'border-danger-500' : ''}`}
              {...register('data_primeira_parcela')}
            />
            {errors.data_primeira_parcela && (
              <p className="mt-1 text-xs text-danger-500">
                {errors.data_primeira_parcela.message}
              </p>
            )}
          </div>
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
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

function DividaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(data: FormData) {
    setServerError(null)
    setIsSubmitting(true)
    try {
      await api.post('/dividas', data)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const e = err as LimiteError
      if (e.response?.status === 403) {
        setServerError(
          e.response.data?.detail ??
            'Você atingiu o limite de dívidas do plano gratuito. Faça upgrade para adicionar mais.'
        )
      } else {
        setServerError('Erro ao salvar dívida.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-gray-800">Nova dívida</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <DividaForm
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
          onClose={onClose}
          submitLabel="Salvar"
        />
      </div>
    </div>
  )
}

function PagarParcelaModal({
  divida,
  onClose,
  onSuccess,
}: {
  divida: Divida
  onClose: () => void
  onSuccess: () => void
}) {
  const hoje = new Date()
  const vencimento = new Date(divida.data_prox_vencimento + 'T00:00:00')
  const atrasada = vencimento < hoje
  const mesAnoAtrasado = vencimento.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const [dataReferencia, setDataReferencia] = useState(divida.data_prox_vencimento)
  const [valorPago, setValorPago] = useState(divida.valor_parcela.toFixed(2).replace('.', ','))
  const [observacao, setObservacao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Calcula o próximo vencimento que resultará da seleção atual
  const proxDataPreview = (() => {
    if (!dataReferencia) return '—'
    const d = new Date(dataReferencia + 'T00:00:00')
    d.setMonth(d.getMonth() + 1)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  })()

  const valorPagoNum = parseFloat(valorPago.replace(',', '.')) || 0

  async function handleConfirmar() {
    setErro(null)
    setIsSubmitting(true)
    try {
      await api.post(`/dividas/${divida.id}/pagar-parcela`, {
        data_referencia: dataReferencia || null,
        valor_pago: valorPagoNum > 0 ? valorPagoNum : null,
        observacao: observacao.trim() || null,
      })
      onSuccess()
      onClose()
    } catch {
      setErro('Erro ao registrar pagamento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">Registrar pagamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info da dívida */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="font-semibold text-gray-800 truncate">{divida.descricao}</p>
            {divida.credor && <p className="text-xs text-gray-400">{divida.credor}</p>}
            <p className="text-sm font-medium text-danger-500 mt-1">
              {formatCurrency(divida.valor_parcela)} / parcela
            </p>
          </div>

          {/* Alerta de atraso */}
          {atrasada && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                A parcela de <strong>{mesAnoAtrasado}</strong> está em atraso. Se você pagou
                a parcela de outro mês, selecione a data correspondente abaixo.
              </p>
            </div>
          )}

          {/* Seleção da data da parcela */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data da parcela que você pagou
            </label>
            <input
              type="date"
              className="input-field"
              value={dataReferencia}
              onChange={(e) => setDataReferencia(e.target.value)}
            />
            {dataReferencia && divida.parcelas_restantes > 1 && (
              <p className="mt-1.5 text-xs text-gray-400">
                Próximo vencimento será: <span className="font-medium text-gray-600">{proxDataPreview}</span>
              </p>
            )}
          </div>

          {/* Valor pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor pago (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="input-field"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
            />
            {valorPagoNum !== divida.valor_parcela && valorPagoNum > 0 && (
              <p className="mt-1.5 text-xs text-amber-600">
                Diferença de {formatCurrency(Math.abs(valorPagoNum - divida.valor_parcela))} em relação ao valor original da parcela.
              </p>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação (opcional)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Ex.: incluiu multa de atraso"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={300}
            />
          </div>

          {erro && (
            <p className="text-sm text-danger-500">{erro}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={isSubmitting || !dataReferencia || valorPagoNum <= 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoricoPagamentosModal({
  divida,
  onClose,
}: {
  divida: Divida
  onClose: () => void
}) {
  const { data: pagamentos = [], isLoading } = useQuery<DividaPagamento[]>({
    queryKey: ['divida-pagamentos', divida.id],
    queryFn: () => api.get(`/dividas/${divida.id}/pagamentos`).then((r) => r.data),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-800">Histórico de pagamentos</h2>
            <p className="text-xs text-gray-400 truncate">{divida.descricao}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : pagamentos.length === 0 ? (
            <div className="text-center py-8">
              <History size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhum pagamento registrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pagamentos.map((p) => {
                const diferenca = p.valor_pago - p.valor_parcela_original
                return (
                  <div key={p.id} className="border border-gray-100 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Parcela de {new Date(p.data_referencia + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-400">
                          Pago em {formatDate(p.data_pagamento)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">{formatCurrency(p.valor_pago)}</p>
                        {diferenca !== 0 && (
                          <p className={`text-xs ${diferenca > 0 ? 'text-danger-500' : 'text-success-600'}`}>
                            {diferenca > 0 ? '+' : ''}{formatCurrency(diferenca)}
                          </p>
                        )}
                      </div>
                    </div>
                    {p.observacao && (
                      <p className="text-xs text-gray-500 italic">{p.observacao}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EditarDividaModal({
  divida,
  onClose,
  onSuccess,
}: {
  divida: Divida
  onClose: () => void
  onSuccess: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const defaultValues: Partial<FormData> = {
    descricao: divida.descricao,
    credor: divida.credor ?? '',
    tipo: divida.tipo,
    valor_total: divida.valor_total,
    valor_parcela: divida.valor_parcela,
    parcelas_restantes: divida.parcelas_restantes,
    taxa_juros_mensal: divida.taxa_juros_mensal ?? 0,
    data_inicio_contrato: divida.data_inicio_contrato ?? '',
    data_primeira_parcela: divida.data_primeira_parcela ?? divida.data_prox_vencimento,
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    setIsSubmitting(true)
    try {
      await api.patch(`/dividas/${divida.id}`, data)
      onSuccess()
      onClose()
    } catch {
      setServerError('Erro ao atualizar dívida.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-gray-800">Editar dívida</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <DividaForm
          defaultValues={defaultValues}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
          onClose={onClose}
          submitLabel="Atualizar"
        />
      </div>
    </div>
  )
}

export default function DividasPage() {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Divida | null>(null)
  const [pagando, setPagando] = useState<Divida | null>(null)
  const [historico, setHistorico] = useState<Divida | null>(null)
  const queryClient = useQueryClient()

  const { data: dividas = [], isLoading } = useQuery<Divida[]>({
    queryKey: ['dividas'],
    queryFn: () => api.get('/dividas').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/dividas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dividas'] }),
  })

  const dividasAtivas = dividas.filter((d) => !d.quitada)
  const totalDevido = dividasAtivas.reduce(
    (acc, d) => acc + d.valor_parcela * d.parcelas_restantes,
    0
  )
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
            const restante = divida.valor_parcela * divida.parcelas_restantes
            const progresso =
              divida.valor_total > 0
                ? Math.min(100, ((divida.valor_total - restante) / divida.valor_total) * 100)
                : 0

            return (
              <div key={divida.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{divida.descricao}</p>
                    {divida.credor && (
                      <p className="text-xs text-gray-400 truncate">{divida.credor}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">
                      Próx. vencimento: {formatDate(divida.data_prox_vencimento)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {divida.parcelas_restantes} parcela(s) restante(s) ·{' '}
                      {formatCurrency(divida.valor_parcela)}/mês
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
