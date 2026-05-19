import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import api from '@/services/api'
import { parseApiError } from '@/utils/api'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { rendaSchema } from '@/lib/schemas/financeiro'
import type { RendaFormData } from '@/lib/schemas/financeiro'
import type { Renda } from '@/types/financeiro'

export const FREQUENCIAS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'semanal', label: 'Semanal' },
]

export const TIPOS = [
  { value: 'salario', label: 'Salário' },
  { value: 'freela', label: 'Freelance' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'outro', label: 'Outro' },
]

const schema = rendaSchema
type FormData = RendaFormData

export function RendaModal({
  renda,
  onClose,
  onSuccess,
}: {
  renda?: Renda
  onClose: () => void
  onSuccess: () => void
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: renda
      ? { descricao: renda.descricao, valor: renda.valor, frequencia: renda.frequencia, tipo: renda.tipo }
      : { frequencia: 'mensal', tipo: 'salario' },
  })

  const [erroForm, setErroForm] = useState('')

  async function onSubmit(data: FormData) {
    setErroForm('')
    try {
      if (renda) {
        await api.patch(`/rendas/${renda.id}`, data)
      } else {
        await api.post('/rendas', data)
      }
      onSuccess()
      onClose()
    } catch (err) {
      setErroForm(parseApiError(err) ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <ModalDialog title={renda ? 'Editar renda' : 'Nova entrada de renda'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <input
            type="text"
            className={`input-field ${errors.descricao ? 'border-danger-500' : ''}`}
            placeholder="Ex.: Salário CLT, Freela design..."
            {...register('descricao')}
          />
          {errors.descricao && (
            <p className="mt-1 text-xs text-danger-500">{errors.descricao.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
          <Controller
            name="valor"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                {...field}
                className={`input-field ${errors.valor ? 'border-danger-500' : ''}`}
                placeholder="0,00"
              />
            )}
          />
          {errors.valor && (
            <p className="mt-1 text-xs text-danger-500">{errors.valor.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select className="input-field" {...register('tipo')}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequência</label>
            <select className="input-field" {...register('frequencia')}>
              {FREQUENCIAS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
        {erroForm && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erroForm}</p>}
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
    </ModalDialog>
  )
}
