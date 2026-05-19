import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, X, CreditCard, Landmark, RefreshCw } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { contaPagarSchema, editarContaPagarSchema } from '@/lib/schemas/financeiro'
import type { ContaPagarFormData, EditarContaPagarFormData } from '@/lib/schemas/financeiro'
import type { ContaAPagar } from '@/types/financeiro'

export const CATEGORIAS = [
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

const schema = contaPagarSchema
type FormData = ContaPagarFormData

const editSchema = editarContaPagarSchema
type EditFormData = EditarContaPagarFormData

export function EditarContaModal({
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

export function PagarContaModal({
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

export function ContaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (count: number) => void }) {
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
