import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2, Loader2, Pencil, AlertTriangle, History } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { dividaSchema } from '@/lib/schemas/financeiro'
import type { DividaFormData } from '@/lib/schemas/financeiro'
import type { Divida, DividaPagamento } from '@/types/financeiro'

interface LimiteError {
  response?: { status: number; data?: { detail?: string } }
}

const schema = dividaSchema
type FormData = DividaFormData

// Formulário compartilhado entre criação e edição
export function DividaForm({
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

export function DividaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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

export function EditarDividaModal({
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

export function PagarParcelaModal({
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

export function HistoricoPagamentosModal({
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
