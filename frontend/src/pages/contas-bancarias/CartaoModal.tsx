import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import api from '@/services/api'
import { parseApiError } from '@/utils/api'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { cartaoCreditoSchema } from '@/lib/schemas/financeiro'
import type { CartaoCreditoFormData } from '@/lib/schemas/financeiro'
import type { CartaoCredito } from '@/types/financeiro'

const BANDEIRAS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'outro', label: 'Outro' },
]

const CORES_PRESET = [
  '#2E7D5E', '#1A3C5E', '#7C3AED', '#DC2626', '#D97706',
  '#0891B2', '#059669', '#9333EA', '#E11D48', '#0284C7',
]

const cartaoSchema = cartaoCreditoSchema
type CartaoFormData = CartaoCreditoFormData

export function CartaoModal({
  cartao,
  onClose,
  onSuccess,
}: {
  cartao?: CartaoCredito
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!cartao
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CartaoFormData>({
    resolver: zodResolver(cartaoSchema),
    defaultValues: cartao
      ? { nome: cartao.nome, bandeira: cartao.bandeira as CartaoFormData['bandeira'], limite: cartao.limite, dia_fechamento: cartao.dia_fechamento, dia_vencimento: cartao.dia_vencimento, cor: cartao.cor }
      : { bandeira: 'visa', dia_fechamento: 1, dia_vencimento: 10, cor: '#1A3C5E' },
  })

  const corAtual = watch('cor')
  const [erro, setErro] = useState('')

  async function onSubmit(data: CartaoFormData) {
    setErro('')
    try {
      if (isEdit) {
        await api.patch(`/cartoes-credito/${cartao!.id}`, data)
      } else {
        await api.post('/cartoes-credito', data)
      }
      onSuccess()
      onClose()
    } catch (err) {
      setErro(parseApiError(err) ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <ModalDialog
      title={isEdit ? 'Editar cartão' : 'Novo cartão de crédito'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do cartão</label>
              <input
                type="text"
                className={`input-field ${errors.nome ? 'border-danger-500' : ''}`}
                placeholder="Ex.: Nubank Roxinho"
                {...register('nome')}
              />
              {errors.nome && <p className="text-xs text-danger-600 mt-1">{errors.nome.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bandeira</label>
              <select className="input-field" {...register('bandeira')}>
                {BANDEIRAS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Limite (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={`input-field ${errors.limite ? 'border-danger-500' : ''}`}
                placeholder="0,00"
                {...register('limite')}
              />
              {errors.limite && <p className="text-xs text-danger-600 mt-1">{errors.limite.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dia fechamento</label>
              <input
                type="number"
                min="1"
                max="31"
                className={`input-field ${errors.dia_fechamento ? 'border-danger-500' : ''}`}
                {...register('dia_fechamento')}
              />
              {errors.dia_fechamento && <p className="text-xs text-danger-600 mt-1">Informe entre 1 e 31</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dia vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                className={`input-field ${errors.dia_vencimento ? 'border-danger-500' : ''}`}
                {...register('dia_vencimento')}
              />
              {errors.dia_vencimento && <p className="text-xs text-danger-600 mt-1">Informe entre 1 e 31</p>}
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
            {isEdit ? 'Salvar alterações' : 'Adicionar cartão'}
          </button>
        </form>
    </ModalDialog>
  )
}
