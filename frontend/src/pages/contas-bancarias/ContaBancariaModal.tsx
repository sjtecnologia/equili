import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import api from '@/services/api'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { contaBancariaSchema } from '@/lib/schemas/financeiro'
import type { ContaBancariaFormData } from '@/lib/schemas/financeiro'
import type { ContaBancaria } from '@/types/financeiro'

const TIPOS_CONTA = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'digital', label: 'Digital' },
]

const CORES_PRESET = [
  '#2E7D5E', '#1A3C5E', '#7C3AED', '#DC2626', '#D97706',
  '#0891B2', '#059669', '#9333EA', '#E11D48', '#0284C7',
]

const contaSchema = contaBancariaSchema
type ContaFormData = ContaBancariaFormData

export function ContaBancariaModal({
  conta,
  onClose,
  onSuccess,
}: {
  conta?: ContaBancaria
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!conta
  const [erro, setErro] = useState('')
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContaFormData>({
    resolver: zodResolver(contaSchema),
    defaultValues: conta
      ? { nome: conta.nome, banco: conta.banco, tipo: conta.tipo as ContaFormData['tipo'], saldo_inicial: conta.saldo_inicial, cor: conta.cor }
      : { tipo: 'corrente', saldo_inicial: 0, cor: '#2E7D5E' },
  })

  const corAtual = watch('cor')

  async function onSubmit(data: ContaFormData) {
    try {
      setErro('')
      if (isEdit) {
        await api.patch(`/contas-bancarias/${conta!.id}`, data)
      } else {
        await api.post('/contas-bancarias', data)
      }
      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErro(msg ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <ModalDialog
      title={isEdit ? 'Editar conta bancária' : 'Nova conta bancária'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da conta</label>
              <input
                type="text"
                className={`input-field ${errors.nome ? 'border-danger-500' : ''}`}
                placeholder="Ex.: Nubank Conta"
                {...register('nome')}
              />
              {errors.nome && <p className="text-xs text-danger-600 mt-1">{errors.nome.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
              <input
                type="text"
                className={`input-field ${errors.banco ? 'border-danger-500' : ''}`}
                placeholder="Ex.: Nubank"
                {...register('banco')}
              />
              {errors.banco && <p className="text-xs text-danger-600 mt-1">{errors.banco.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select className="input-field" {...register('tipo')}>
                {TIPOS_CONTA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`input-field ${errors.saldo_inicial ? 'border-danger-500' : ''}`}
                placeholder="0,00"
                {...register('saldo_inicial')}
              />
              {errors.saldo_inicial && <p className="text-xs text-danger-600 mt-1">{errors.saldo_inicial.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cor do cartão</label>
            <div className="flex gap-2 flex-wrap">
              {CORES_PRESET.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setValue('cor', cor)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${corAtual === cor ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>
          {erro && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erro}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {isEdit ? 'Salvar alterações' : 'Adicionar conta'}
          </button>
        </form>
    </ModalDialog>
  )
}
