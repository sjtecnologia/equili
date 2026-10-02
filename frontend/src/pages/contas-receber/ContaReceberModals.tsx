import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Landmark, RefreshCw } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'
import { parseApiError } from '@/utils/api'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { CategoriaSelect } from '@/components/shared/CategoriaSelect'
import { notify } from '@/utils/notify'
import { invalidateContasReceberAndDashboard } from '@/lib/queryInvalidation'
import { contaReceberSchema, editarContaReceberSchema } from '@/lib/schemas/financeiro'
import type { ContaReceberFormData, EditarContaReceberFormData } from '@/lib/schemas/financeiro'
import type { ContaAReceber } from '@/types/financeiro'
import { useFormSubmit } from '@/hooks/useFormSubmit'

export const ORIGENS = [
  { value: 'salario', label: 'Salário' },
  { value: 'freela', label: 'Freelance' },
  { value: 'venda', label: 'Venda' },
  { value: 'emprestimo', label: 'Empréstimo' },
  { value: 'outro', label: 'Outro' },
]

const MODALIDADES = [
  { value: 'avulsa', label: 'Avulsa', desc: 'Recebimento único', icon: '📄' },
  { value: 'recorrente', label: 'Recorrente', desc: 'Salário, aluguel mensal...', icon: '🔄' },
  { value: 'parcelada', label: 'Parcelada', desc: 'Carnê, parcelas a receber...', icon: '📋' },
]

const schema = contaReceberSchema
type ContaFormData = ContaReceberFormData

const editSchema = editarContaReceberSchema
type EditFormData = EditarContaReceberFormData

interface ContaReceberModalBaseProps {
  conta: ContaAReceber
  onClose: () => void
}

interface ContaReceberModalProps {
  onClose: () => void
}

export function EditarContaReceberModal({
  conta,
  onClose,
}: ContaReceberModalBaseProps) {
  const queryClient = useQueryClient()
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      descricao: conta.descricao,
      origem: conta.origem,
      valor: conta.valor,
      data_prevista: conta.data_prevista,
      tipo: (conta.tipo as 'avulsa' | 'recorrente' | 'parcelada') || 'avulsa',
      devedor: conta.devedor ?? '',
      observacao: conta.observacao ?? '',
    },
  })

  const { submit, error: erroEditar } = useFormSubmit()

  async function onSubmit(data: EditFormData) {
    await submit(async () => {
      await api.patch(`/contas-receber/${conta.id}`, data)
      invalidateContasReceberAndDashboard(queryClient)
      onClose()
    })
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Data prevista</label>
              <input type="date" className={`input-field ${errors.data_prevista ? 'border-danger-500' : ''}`}
                {...register('data_prevista')} />
              {errors.data_prevista && <p className="mt-1 text-xs text-danger-500">{errors.data_prevista.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
            <CategoriaSelect tipo="receita" fallback={ORIGENS} valorAtual={watch('origem')} {...register('origem')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de lançamento</label>
            <select className="input-field" {...register('tipo')}>
              <option value="avulsa">📄 Avulsa (único)</option>
              <option value="recorrente">🔄 Recorrente (todo mês)</option>
              <option value="parcelada">📋 Parcelada / Financiamento</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Devedor (opcional)</label>
            <input type="text" className="input-field" {...register('devedor')} />
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

export function ReceberContaModal({
  conta,
  onClose,
}: ContaReceberModalBaseProps) {
  const queryClient = useQueryClient()
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().slice(0, 10))
  const [registrarNaConta, setRegistrarNaConta] = useState(false)
  const [contaSelecionada, setContaSelecionada] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [erroReceber, setErroReceber] = useState('')

  const { data: contas } = useQuery<{ id: string; nome: string; banco: string }[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/contas-bancarias').then((r) => r.data),
  })

  async function handleConfirmar() {
    setIsSubmitting(true)
    setErroReceber('')
    try {
      await api.patch(`/contas-receber/${conta.id}/receber`, {
        data_recebimento: dataRecebimento || null,
        conta_bancaria_id: registrarNaConta && contaSelecionada ? contaSelecionada : null,
      })
      invalidateContasReceberAndDashboard(queryClient)
      onClose()
    } catch (err) {
      setErroReceber(parseApiError(err) ?? 'Erro ao registrar recebimento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const podeConfirmar = !isSubmitting && !!dataRecebimento &&
    (!registrarNaConta || !!contaSelecionada)

  return (
    <ModalDialog title="Confirmar recebimento" onClose={onClose} size="sm">
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="font-semibold text-gray-800 truncate">{conta.descricao}</p>
            <p className="text-sm font-bold text-success-500 mt-1">{formatCurrency(conta.valor)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data do recebimento</label>
            <input type="date" className="input-field" value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)} />
          </div>
          {/* Registrar entrada em conta bancária */}
          <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
            border-gray-200 hover:border-primary-300">
            <input type="checkbox" className="w-4 h-4 accent-primary-500"
              checked={registrarNaConta} onChange={(e) => setRegistrarNaConta(e.target.checked)} />
            <div className="flex items-center gap-2">
              <Landmark size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Registrar entrada em conta bancária</span>
            </div>
          </label>
          {registrarNaConta && (
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
          {erroReceber && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erroReceber}</p>}
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

export function ContaModal({ onClose }: ContaReceberModalProps) {
  const queryClient = useQueryClient()
  const { submit, error: serverError } = useFormSubmit()
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContaFormData>({
    resolver: zodResolver(schema),
    defaultValues: { origem: '', modalidade: 'avulsa' },
  })

  const modalidade = watch('modalidade')
  const dataPrevista = watch('data_prevista')

  function mesesAteDezembroLabel() {
    if (!dataPrevista) return ''
    const d = new Date(dataPrevista + 'T00:00:00')
    const mes = d.getMonth() + 1
    const ano = d.getFullYear()
    const n = 12 - mes + 1
    return `Serão criados ${n} lançamento(s) mensais até dezembro de ${ano}.`
  }

  async function onSubmit(data: ContaFormData) {
    await submit(async () => {
      const res = await api.post('/contas-receber', data)
      const count = Array.isArray(res.data) ? res.data.length : 1
      invalidateContasReceberAndDashboard(queryClient)
      if (count > 1) {
        notify.success(`${count} lançamentos criados com sucesso!`)
      }
      onClose()
    })
  }

  return (
    <ModalDialog title="Nova conta a receber" onClose={onClose} scrollable>
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
              placeholder="Ex.: Salário maio, Freela logotipo..."
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
                {modalidade === 'parcelada' ? '1ª data prevista' : 'Data prevista'}
              </label>
              <input
                type="date"
                className={`input-field ${errors.data_prevista ? 'border-danger-500' : ''}`}
                {...register('data_prevista')}
              />
              {errors.data_prevista && (
                <p className="mt-1 text-xs text-danger-500">{errors.data_prevista.message}</p>
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
                placeholder="Ex.: 6"
                {...register('numero_parcelas', {
                  setValueAs: (value) => (value === '' || value == null ? undefined : Number(value)),
                })}
              />
              {errors.numero_parcelas && (
                <p className="mt-1 text-xs text-danger-500">{errors.numero_parcelas.message}</p>
              )}
            </div>
          )}

          {/* Info recorrente */}
          {modalidade === 'recorrente' && dataPrevista && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
              <RefreshCw size={14} className="mt-0.5 shrink-0" />
              <span>{mesesAteDezembroLabel()}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
            <CategoriaSelect tipo="receita" fallback={ORIGENS} valorAtual={watch('origem')} {...register('origem')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Devedor <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Nome de quem deve pagar..."
              {...register('devedor')}
            />
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
