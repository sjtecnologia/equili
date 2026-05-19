import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import api from '@/services/api'
import { parseApiError } from '@/utils/api'
import { useAuthStore } from '@/stores/authStore'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { investimentoSchema } from '@/lib/schemas/financeiro'
import type { InvestimentoFormData } from '@/lib/schemas/financeiro'
import type { Investimento } from '@/types/financeiro'

const schema = investimentoSchema
type FormData = InvestimentoFormData

export const TIPO_LABELS: Record<string, string> = {
  acoes: 'Ações',
  fii: 'FII',
  renda_fixa: 'Renda Fixa',
  criptomoeda: 'Criptomoeda',
  tesouro: 'Tesouro Direto',
  outro: 'Outro',
}

export const TIPO_COLORS: Record<string, string> = {
  acoes: 'bg-blue-100 text-blue-700',
  fii: 'bg-purple-100 text-purple-700',
  renda_fixa: 'bg-green-100 text-green-700',
  criptomoeda: 'bg-orange-100 text-orange-700',
  tesouro: 'bg-teal-100 text-teal-700',
  outro: 'bg-gray-100 text-gray-600',
}

export function InvestimentoModal({
  onClose,
  editando,
}: {
  onClose: () => void
  editando: Investimento | null
}) {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editando
      ? {
          nome: editando.nome,
          tipo: editando.tipo as FormData['tipo'],
          instituicao: editando.instituicao ?? '',
          quantidade: editando.quantidade ?? undefined,
          preco_medio: editando.preco_medio ?? undefined,
          valor_investido: editando.valor_investido,
          valor_atual: editando.valor_atual,
          data_aplicacao: editando.data_aplicacao,
          observacao: editando.observacao ?? '',
        }
      : {
          tipo: 'renda_fixa',
          data_aplicacao: new Date().toISOString().split('T')[0],
          valor_investido: 0,
          valor_atual: 0,
        },
  })

  const [erroForm, setErroForm] = useState('')

  const onSubmit = async (data: FormData) => {
    setErroForm('')
    try {
      const headers = { Authorization: `Bearer ${token}` }
      if (editando) {
        await api.patch(`/investimentos/${editando.id}`, data, { headers })
      } else {
        await api.post('/investimentos', data, { headers })
      }
      qc.invalidateQueries({ queryKey: ['investimentos'] })
      qc.invalidateQueries({ queryKey: ['investimentos-resumo'] })
      onClose()
    } catch (err) {
      setErroForm(parseApiError(err) ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <ModalDialog
      title={editando ? 'Editar investimento' : 'Novo investimento'}
      onClose={onClose}
      scrollable
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome / Ticker *</label>
            <input type="text" placeholder="Ex: IVVB11, CDB XP, BTC" className="input-field" {...register('nome')} />
            {errors.nome && <p className="mt-1 text-xs text-danger-500">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select className="input-field" {...register('tipo')}>
                {Object.entries(TIPO_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instituição</label>
              <input type="text" placeholder="XP, Nubank..." className="input-field" {...register('instituicao')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor investido *</label>
              <CurrencyInput
                value={watch('valor_investido')}
                onChange={(v: number) => setValue('valor_investido', v, { shouldValidate: true })}
                placeholder="R$ 0,00"
                className={errors.valor_investido ? 'border-danger-500' : ''}
              />
              {errors.valor_investido && <p className="mt-1 text-xs text-danger-500">{errors.valor_investido.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor atual *</label>
              <CurrencyInput
                value={watch('valor_atual')}
                onChange={(v: number) => setValue('valor_atual', v, { shouldValidate: true })}
                placeholder="R$ 0,00"
                className={errors.valor_atual ? 'border-danger-500' : ''}
              />
              {errors.valor_atual && <p className="mt-1 text-xs text-danger-500">{errors.valor_atual.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
              <input
                type="number"
                step="any"
                placeholder="Ex: 10"
                className="input-field"
                {...register('quantidade', { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço médio</label>
              <CurrencyInput
                value={watch('preco_medio') ?? 0}
                onChange={(v: number) => setValue('preco_medio', v || undefined)}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de aplicação *</label>
            <input type="date" className="input-field" {...register('data_aplicacao')} />
            {errors.data_aplicacao && <p className="mt-1 text-xs text-danger-500">{errors.data_aplicacao.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <textarea rows={2} className="input-field resize-none" placeholder="Vencimento, estratégia..." {...register('observacao')} />
          </div>

          {erroForm && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erroForm}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-primary flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {editando ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
    </ModalDialog>
  )
}
