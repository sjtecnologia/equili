import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, Loader2, CheckCircle, Lock, Pencil, AlertTriangle, History, CalendarClock } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'

interface Divida {
  id: string
  descricao: string
  credor: string | null
  tipo: string
  valor_total: number
  valor_parcela: number
  parcelas_totais: number | null
  parcelas_restantes: number
  parcelas_atrasadas: number
  data_primeira_atrasada: string | null
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

interface ContaFixaAtrasada {
  descricao: string
  categoria: string
  meses_atrasados: number
  total: number
  primeira_data: string
  ultima_data: string
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
  parcelas_totais: z.coerce.number().int().min(1).optional().nullable(),
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

      {/* Parcelas */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total de parcelas</label>
          <input
            type="number"
            min="1"
            className="input-field"
            placeholder="Ex.: 24"
            {...register('parcelas_totais')}
          />
          <p className="mt-1 text-xs text-gray-400">Qtd total do contrato</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Restantes *</label>
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
    <ModalDialog title="Nova dívida" onClose={onClose} scrollable>
      <DividaForm
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        serverError={serverError}
        onClose={onClose}
        submitLabel="Salvar"
      />
    </ModalDialog>
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
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))
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
        data_pagamento: dataPagamento || null,
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
    <ModalDialog title="Registrar pagamento" onClose={onClose} size="sm">
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
              Parcela que foi paga (mês de referência)
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

          {/* Data em que o pagamento foi realizado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data em que você pagou
            </label>
            <input
              type="date"
              className="input-field"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
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
    </ModalDialog>
  )
}

function HistoricoPagamentosModal({
  divida,
  onClose,
}: {
  divida: Divida
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const queryKey = ['divida-pagamentos', divida.id]

  const { data: pagamentos = [], isLoading } = useQuery<DividaPagamento[]>({
    queryKey,
    queryFn: () => api.get(`/dividas/${divida.id}/pagamentos`).then((r) => r.data),
  })

  // Edição inline
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ data_referencia: '', data_pagamento: '', valor_pago: '', observacao: '' })
  const [editErro, setEditErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Exclusão
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/dividas/${divida.id}/pagamentos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  function abrirEdicao(p: DividaPagamento) {
    setEditandoId(p.id)
    setEditErro(null)
    setEditForm({
      data_referencia: p.data_referencia,
      data_pagamento: p.data_pagamento,
      valor_pago: String(p.valor_pago).replace('.', ','),
      observacao: p.observacao ?? '',
    })
  }

  async function salvarEdicao(id: string) {
    setEditErro(null)
    setSalvando(true)
    try {
      const valorNum = parseFloat(editForm.valor_pago.replace(',', '.'))
      if (!valorNum || valorNum <= 0) throw new Error('Valor inválido')
      await api.patch(`/dividas/${divida.id}/pagamentos/${id}`, {
        data_referencia: editForm.data_referencia || null,
        data_pagamento: editForm.data_pagamento || null,
        valor_pago: valorNum,
        observacao: editForm.observacao.trim() || null,
      })
      await queryClient.invalidateQueries({ queryKey })
      setEditandoId(null)
    } catch {
      setEditErro('Erro ao salvar. Verifique os dados.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalDialog title="Histórico de pagamentos" onClose={onClose} subtitle={divida.descricao} scrollable>
        <div className="p-4">
          {isLoading ? (
            <SkeletonList count={3} height="h-16" />
          ) : pagamentos.length === 0 ? (
            <EmptyState icon={History} title="Nenhum pagamento registrado ainda." />
          ) : (
            <div className="space-y-2">
              {pagamentos.map((p) => {
                const diferenca = p.valor_pago - p.valor_parcela_original
                const esteEditando = editandoId === p.id
                const esteConfirmando = confirmandoId === p.id

                if (esteEditando) {
                  return (
                    <div key={p.id} className="border border-primary-200 rounded-xl p-3 space-y-3 bg-primary-50/30">
                      <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">Editando baixa</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Parcela (mês ref.)</label>
                          <input type="date" className="input-field text-sm py-1.5" value={editForm.data_referencia}
                            onChange={(e) => setEditForm((f) => ({ ...f, data_referencia: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Data do pagamento</label>
                          <input type="date" className="input-field text-sm py-1.5" value={editForm.data_pagamento}
                            onChange={(e) => setEditForm((f) => ({ ...f, data_pagamento: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Valor pago (R$)</label>
                        <input type="text" inputMode="decimal" className="input-field text-sm py-1.5" value={editForm.valor_pago}
                          onChange={(e) => setEditForm((f) => ({ ...f, valor_pago: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Observação</label>
                        <input type="text" className="input-field text-sm py-1.5" placeholder="Ex.: multa de atraso"
                          value={editForm.observacao} maxLength={300}
                          onChange={(e) => setEditForm((f) => ({ ...f, observacao: e.target.value }))} />
                      </div>
                      {editErro && <p className="text-xs text-danger-500">{editErro}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => setEditandoId(null)} className="btn-ghost text-xs flex-1">Cancelar</button>
                        <button onClick={() => salvarEdicao(p.id)} disabled={salvando}
                          className="btn-primary text-xs flex-1 flex items-center justify-center gap-1">
                          {salvando && <Loader2 size={12} className="animate-spin" />}
                          Salvar
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={p.id} className="border border-gray-100 rounded-xl p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          Parcela de {new Date(p.data_referencia + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-400">
                          Pago em {formatDate(p.data_pagamento)}
                        </p>
                        {p.observacao && (
                          <p className="text-xs text-gray-500 italic mt-0.5">{p.observacao}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-800">{formatCurrency(p.valor_pago)}</p>
                        {diferenca !== 0 && (
                          <p className={`text-xs ${diferenca > 0 ? 'text-danger-500' : 'text-success-600'}`}>
                            {diferenca > 0 ? '+' : ''}{formatCurrency(diferenca)}
                          </p>
                        )}
                        <div className="flex gap-1 justify-end mt-1.5">
                          <button onClick={() => abrirEdicao(p)}
                            className="text-gray-300 hover:text-primary-500 transition-colors"
                            aria-label="Editar baixa">
                            <Pencil size={13} />
                          </button>
                          {esteConfirmando ? (
                            <>
                              <button onClick={() => { deleteMutation.mutate(p.id); setConfirmandoId(null) }}
                                className="text-xs text-danger-500 font-medium hover:underline">
                                Confirmar
                              </button>
                              <button onClick={() => setConfirmandoId(null)}
                                className="text-xs text-gray-400 hover:underline">
                                Não
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmandoId(p.id)}
                              className="text-gray-300 hover:text-danger-500 transition-colors"
                              aria-label="Excluir baixa">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
    </ModalDialog>
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
    parcelas_totais: divida.parcelas_totais ?? undefined,
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
    <ModalDialog title="Editar dívida" onClose={onClose} scrollable>
      <DividaForm
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        serverError={serverError}
        onClose={onClose}
        submitLabel="Atualizar"
      />
    </ModalDialog>
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
    staleTime: 5 * 60_000,
  })

  const { data: contasFixasAtrasadas = [] } = useQuery<ContaFixaAtrasada[]>({
    queryKey: ['contas-fixas-atrasadas'],
    queryFn: () => api.get('/contas-pagar/fixas-atrasadas').then((r) => r.data),
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

  // Parcelas em atraso — calculado pelo backend via histórico de pagamentos
  const dividasComAtraso = dividasAtivas.filter((d) => d.parcelas_atrasadas > 0).length
  const parcelasAtrasadasTotal = dividasAtivas.reduce((acc, d) => acc + d.parcelas_atrasadas, 0)
  const valorAtrasado = dividasAtivas.reduce(
    (acc, d) => acc + d.parcelas_atrasadas * d.valor_parcela,
    0
  )

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dividas'] })

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
