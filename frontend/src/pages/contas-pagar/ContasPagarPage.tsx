import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, Loader2, X, CheckCircle2, AlertCircle, RefreshCw, Layers, Pencil, CreditCard, Landmark } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'

interface ContaAPagar {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_vencimento: string
  status: 'pendente' | 'pago' | 'vencido'
  tipo: string
  observacao: string | null
}

const CATEGORIAS = [
  { value: 'moradia', label: 'Moradia' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'saude', label: 'Saúde' },
  { value: 'educacao', label: 'Educação' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'lazer', label: 'Lazer' },
  { value: 'outro', label: 'Outro' },
]

const MODALIDADES = [
  { value: 'avulsa', label: 'Avulsa', desc: 'Lançamento único', icon: '📄' },
  { value: 'recorrente', label: 'Recorrente', desc: 'Água, luz, internet...', icon: '🔄' },
  { value: 'parcelada', label: 'Parcelada', desc: 'Financiamento, carnê...', icon: '📋' },
]

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  pendente: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  pago: { label: 'Pago', classes: 'bg-green-100 text-green-700' },
  vencido: { label: 'Vencido', classes: 'bg-red-100 text-red-700' },
}

const schema = z
  .object({
    descricao: z.string().min(1, 'Descrição obrigatória'),
    categoria: z.string().min(1, 'Selecione a categoria'),
    valor: z.coerce.number().positive('Valor deve ser positivo'),
    data_vencimento: z.string().min(1, 'Data obrigatória'),
    modalidade: z.enum(['avulsa', 'recorrente', 'parcelada']),
    numero_parcelas: z.coerce.number().int().min(2).optional().nullable(),
    observacao: z.string().optional(),
  })
  .refine(
    (d) => d.modalidade !== 'parcelada' || (d.numero_parcelas != null && d.numero_parcelas >= 2),
    { message: 'Informe ao menos 2 parcelas', path: ['numero_parcelas'] },
  )

type FormData = z.infer<typeof schema>

const editSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  categoria: z.string().min(1),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data_vencimento: z.string().min(1, 'Data obrigatória'),
  tipo: z.enum(['avulsa', 'fixa', 'variavel']),
  observacao: z.string().optional(),
})
type EditFormData = z.infer<typeof editSchema>

function EditarContaModal({
  conta,
  onClose,
  onSuccess,
}: {
  conta: ContaAPagar
  onClose: () => void
  onSuccess: () => void
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      descricao: conta.descricao,
      categoria: conta.categoria,
      valor: conta.valor,
      data_vencimento: conta.data_vencimento,
      tipo: (conta.tipo as 'avulsa' | 'fixa' | 'variavel') || 'avulsa',
      observacao: conta.observacao ?? '',
    },
  })

  const [erroEditar, setErroEditar] = useState('')

  async function onSubmit(data: EditFormData) {
    setErroEditar('')
    try {
      await api.patch(`/contas-pagar/${conta.id}`, data)
      onSuccess()
      onClose()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErroEditar(detail ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <ModalDialog title="Editar conta" onClose={onClose} scrollable>
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" className={`input-field ${errors.descricao ? 'border-danger-500' : ''}`}
              {...register('descricao')} />
            {errors.descricao && <p className="mt-1 text-xs text-danger-500">{errors.descricao.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <Controller name="valor" control={control}
                render={({ field }) => (
                  <CurrencyInput {...field} className={`input-field ${errors.valor ? 'border-danger-500' : ''}`} />
                )} />
              {errors.valor && <p className="mt-1 text-xs text-danger-500">{errors.valor.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
              <input type="date" className={`input-field ${errors.data_vencimento ? 'border-danger-500' : ''}`}
                {...register('data_vencimento')} />
              {errors.data_vencimento && <p className="mt-1 text-xs text-danger-500">{errors.data_vencimento.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select className="input-field" {...register('categoria')}>
              {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de lançamento</label>
            <select className="input-field" {...register('tipo')}>
              <option value="avulsa">📄 Avulsa (lançamento único)</option>
              <option value="fixa">🔄 Recorrente (condomínio, água, luz…)</option>
              <option value="variavel">📋 Parcelada / Financiamento</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">Altera apenas este lançamento.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <input type="text" className="input-field" {...register('observacao')} />
          </div>
          {erroEditar && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erroEditar}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
    </ModalDialog>
  )
}

function PagarContaModal({
  conta,
  onClose,
  onSuccess,
}: {
  conta: ContaAPagar
  onClose: () => void
  onSuccess: () => void
}) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))
  const [meioPagamento, setMeioPagamento] = useState<'nenhum' | 'conta' | 'cartao'>('nenhum')
  const [contaSelecionada, setContaSelecionada] = useState('')
  const [cartaoSelecionado, setCartaoSelecionado] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [erroPagar, setErroPagar] = useState('')

  const { data: contas } = useQuery<{ id: string; nome: string; banco: string }[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/contas-bancarias').then((r) => r.data),
  })
  const { data: cartoes } = useQuery<{ id: string; nome: string; bandeira: string }[]>({
    queryKey: ['cartoes-credito'],
    queryFn: () => api.get('/cartoes-credito').then((r) => r.data),
  })

  async function handleConfirmar() {
    setIsSubmitting(true)
    setErroPagar('')
    try {
      await api.patch(`/contas-pagar/${conta.id}/pagar`, {
        data_pagamento: dataPagamento || null,
        conta_bancaria_id: meioPagamento === 'conta' && contaSelecionada ? contaSelecionada : null,
        cartao_credito_id: meioPagamento === 'cartao' && cartaoSelecionado ? cartaoSelecionado : null,
      })
      onSuccess()
      onClose()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErroPagar(detail ?? 'Erro ao registrar pagamento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const podeConfirmar = !isSubmitting && !!dataPagamento &&
    (meioPagamento === 'nenhum' ||
     (meioPagamento === 'conta' && !!contaSelecionada) ||
     (meioPagamento === 'cartao' && !!cartaoSelecionado))

  return (
    <ModalDialog title="Confirmar pagamento" onClose={onClose} size="sm">
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="font-semibold text-gray-800 truncate">{conta.descricao}</p>
            <p className="text-sm font-bold text-danger-500 mt-1">{formatCurrency(conta.valor)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data do pagamento</label>
            <input type="date" className="input-field" value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)} />
          </div>
          {/* Meio de pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Registrar saída em</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'nenhum', label: 'Nenhum', icon: <X size={16} /> },
                { value: 'conta', label: 'Conta', icon: <Landmark size={16} /> },
                { value: 'cartao', label: 'Cartão', icon: <CreditCard size={16} /> },
              ].map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setMeioPagamento(opt.value as typeof meioPagamento)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    meioPagamento === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-500'
                  }`}>
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {meioPagamento === 'conta' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta bancária</label>
              <select className="input-field" value={contaSelecionada} onChange={(e) => setContaSelecionada(e.target.value)}>
                <option value="">Selecione...</option>
                {contas?.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.banco}</option>
                ))}
              </select>
            </div>
          )}
          {meioPagamento === 'cartao' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cartão de crédito</label>
              <select className="input-field" value={cartaoSelecionado} onChange={(e) => setCartaoSelecionado(e.target.value)}>
                <option value="">Selecione...</option>
                {cartoes?.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.bandeira}</option>
                ))}
              </select>
            </div>
          )}
          {erroPagar && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erroPagar}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
            <button onClick={handleConfirmar} disabled={!podeConfirmar}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
    </ModalDialog>
  )
}

function ContaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (count: number) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { categoria: 'outro', modalidade: 'avulsa' },
  })

  const modalidade = watch('modalidade')
  const dataVencimento = watch('data_vencimento')

  function mesesAteDezembroLabel() {
    if (!dataVencimento) return ''
    const d = new Date(dataVencimento + 'T00:00:00')
    const mes = d.getMonth() + 1
    const ano = d.getFullYear()
    const n = 12 - mes + 1
    return `Serão criados ${n} lançamento(s) mensais até dezembro de ${ano}.`
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const res = await api.post('/contas-pagar', data)
      const count = Array.isArray(res.data) ? res.data.length : 1
      onSuccess(count)
      onClose()
    } catch {
      setServerError('Erro ao salvar conta. Verifique os dados e tente novamente.')
    }
  }

  return (
    <ModalDialog title="Nova conta a pagar" onClose={onClose} scrollable>
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Modalidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de lançamento</label>
            <div className="grid grid-cols-3 gap-2">
              {MODALIDADES.map((m) => (
                <label
                  key={m.value}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-colors text-center ${
                    modalidade === m.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input type="radio" value={m.value} {...register('modalidade')} className="sr-only" />
                  <span className="text-xl mb-1">{m.icon}</span>
                  <span className="text-xs font-semibold text-gray-800">{m.label}</span>
                  <span className="text-xs text-gray-500 leading-tight mt-0.5">{m.desc}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              className={`input-field ${errors.descricao ? 'border-danger-500' : ''}`}
              placeholder="Ex.: Aluguel, Conta de luz..."
              {...register('descricao')}
            />
            {errors.descricao && (
              <p className="mt-1 text-xs text-danger-500">{errors.descricao.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <Controller
                name="valor"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    {...field}
                    className={`input-field ${errors.valor ? 'border-danger-500' : ''}`}
                  />
                )}
              />
              {errors.valor && (
                <p className="mt-1 text-xs text-danger-500">{errors.valor.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {modalidade === 'parcelada' ? '1ª data de vencimento' : 'Vencimento'}
              </label>
              <input
                type="date"
                className={`input-field ${errors.data_vencimento ? 'border-danger-500' : ''}`}
                {...register('data_vencimento')}
              />
              {errors.data_vencimento && (
                <p className="mt-1 text-xs text-danger-500">{errors.data_vencimento.message}</p>
              )}
            </div>
          </div>

          {/* Número de parcelas */}
          {modalidade === 'parcelada' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de parcelas</label>
              <input
                type="number"
                min={2}
                className={`input-field ${errors.numero_parcelas ? 'border-danger-500' : ''}`}
                placeholder="Ex.: 12"
                {...register('numero_parcelas')}
              />
              {errors.numero_parcelas && (
                <p className="mt-1 text-xs text-danger-500">{errors.numero_parcelas.message}</p>
              )}
            </div>
          )}

          {/* Info recorrente */}
          {modalidade === 'recorrente' && dataVencimento && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
              <RefreshCw size={14} className="mt-0.5 shrink-0" />
              <span>{mesesAteDezembroLabel()}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select className="input-field" {...register('categoria')}>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Informações adicionais..."
              {...register('observacao')}
            />
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
              {modalidade === 'avulsa' ? 'Salvar' : 'Gerar lançamentos'}
            </button>
          </div>
        </form>
    </ModalDialog>
  )
}

export default function ContasPagarPage() {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<ContaAPagar | null>(null)
  const [pagando, setPagando] = useState<ContaAPagar | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: contas = [], isLoading } = useQuery<ContaAPagar[]>({
    queryKey: ['contas-pagar'],
    queryFn: () => api.get('/contas-pagar').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contas-pagar/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const pagarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/contas-pagar/${id}/pagar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const contasFiltradas = useMemo(
    () => filtroStatus === 'todos' ? contas : contas.filter((c) => c.status === filtroStatus),
    [contas, filtroStatus]
  )

  const { totalPendente, totalPago } = useMemo(() => ({
    totalPendente: contas.filter((c) => c.status !== 'pago').reduce((acc, c) => acc + c.valor, 0),
    totalPago: contas.filter((c) => c.status === 'pago').reduce((acc, c) => acc + c.valor, 0),
  }), [contas])

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }, [queryClient])

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <PageHeader
        title="Contas a Pagar"
        subtitle={`${contas.filter((c) => c.status !== 'pago').length} conta(s) pendente(s)`}
        action={{ label: 'Adicionar', onClick: () => setShowModal(true) }}
      />

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">A pagar</p>
          <p className="text-xl font-bold text-danger-500">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Já pago</p>
          <p className="text-xl font-bold text-success-500">{formatCurrency(totalPago)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['todos', 'pendente', 'vencido', 'pago'].map((f) => (
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
            const isVencido = conta.status === 'vencido'
            return (
              <div
                key={conta.id}
                className={`card p-4 space-y-3 ${isVencido ? 'border border-red-200' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
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
                  <p className="font-bold text-gray-800 whitespace-nowrap shrink-0">
                    {formatCurrency(conta.valor)}
                  </p>
                </div>

                {conta.observacao && (
                  <p className="text-xs text-gray-400 italic">{conta.observacao}</p>
                )}

                <div className="flex gap-2">
                  {conta.status !== 'pago' && (
                    <button
                      onClick={() => setPagando(conta)}
                      disabled={pagarMutation.isPending}
                      className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={12} />
                      Marcar como pago
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
              setSuccessMsg(`${count} lançamentos criados com sucesso!`)
              setTimeout(() => setSuccessMsg(null), 4000)
            }
          }}
        />
      )}
      {editando && (
        <EditarContaModal
          conta={editando}
          onClose={() => setEditando(null)}
          onSuccess={invalidate}
        />
      )}
      {pagando && (
        <PagarContaModal
          conta={pagando}
          onClose={() => setPagando(null)}
          onSuccess={invalidate}
        />
      )}

      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-2 text-white/70 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
