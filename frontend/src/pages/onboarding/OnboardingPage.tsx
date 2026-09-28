import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle } from 'lucide-react'
import api from '@/services/api'
import { useQueryClient } from '@tanstack/react-query'

const TOTAL_STEPS = 3

// Etapa 1: renda
const rendaSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  frequencia: z.string().min(1),
  tipo: z.string().min(1),
})
type RendaForm = z.infer<typeof rendaSchema>

// Etapa 2: dívida
const dividaSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  credor: z.string().optional(),
  tipo: z.string().min(1),
  valor_total: z.coerce.number().positive('Valor deve ser positivo'),
  valor_parcela: z.coerce.number().positive('Valor da parcela deve ser positivo'),
  parcelas_restantes: z.coerce.number().int().min(1),
  data_prox_vencimento: z.string().min(1, 'Data obrigatória'),
})
type DividaForm = z.infer<typeof dividaSchema>

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i < current ? 'bg-primary-500 w-8' : i === current ? 'bg-primary-400 w-8' : 'bg-gray-200 w-4'
          }`}
        />
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)

  const rendaForm = useForm<RendaForm>({
    resolver: zodResolver(rendaSchema),
    defaultValues: { descricao: 'Salário', frequencia: 'mensal', tipo: 'salario', valor: undefined },
  })

  const dividaForm = useForm<DividaForm>({
    resolver: zodResolver(dividaSchema),
    defaultValues: { tipo: 'emprestimo' },
  })

  async function handleRendaSubmit(data: RendaForm) {
    await api.post('/rendas', data)
    queryClient.invalidateQueries({ queryKey: ['rendas'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    setStep(1)
  }

  async function handleDividaSubmit(data: DividaForm) {
    await api.post('/dividas', data)
    queryClient.invalidateQueries({ queryKey: ['dividas'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    setStep(2)
  }

  function handleSkip() {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1)
    else navigate('/dashboard', { replace: true })
  }

  function handleFinish() {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary-500">Bem-vindo(a)!</h1>
          <p className="text-sm text-gray-500 mt-1">Vamos configurar seu perfil financeiro</p>
        </div>

        <StepIndicator current={step} />

        {/* Etapa 0: Renda */}
        {step === 0 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Qual é sua renda principal?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Isso nos ajuda a calcular seu saldo livre.
            </p>
            <form onSubmit={rendaForm.handleSubmit(handleRendaSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex.: Salário"
                  {...rendaForm.register('descricao')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-field"
                  placeholder="0,00"
                  {...rendaForm.register('valor')}
                />
                {rendaForm.formState.errors.valor && (
                  <p className="mt-1 text-xs text-danger-500">
                    {rendaForm.formState.errors.valor.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select className="input-field" {...rendaForm.register('tipo')}>
                    <option value="salario">Salário</option>
                    <option value="freela">Freelance</option>
                    <option value="aluguel">Aluguel</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequência</label>
                  <select className="input-field" {...rendaForm.register('frequencia')}>
                    <option value="mensal">Mensal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={handleSkip} className="btn-ghost flex-1 text-sm">
                  Pular
                </button>
                <button
                  type="submit"
                  disabled={rendaForm.formState.isSubmitting}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {rendaForm.formState.isSubmitting && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Próximo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Etapa 1: Dívida */}
        {step === 1 && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Adicione sua primeira dívida</h2>
            <p className="text-sm text-gray-500 mb-4">
              Pode ser um cartão de crédito, empréstimo ou qualquer outra dívida.
            </p>
            <form onSubmit={dividaForm.handleSubmit(handleDividaSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex.: Parcelas do carro"
                  {...dividaForm.register('descricao')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select className="input-field" {...dividaForm.register('tipo')}>
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
                    {...dividaForm.register('credor')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="0,00"
                    {...dividaForm.register('valor_total')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parcela (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="0,00"
                    {...dividaForm.register('valor_parcela')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº parcelas</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    placeholder="12"
                    {...dividaForm.register('parcelas_restantes', {
                      setValueAs: (value) => (value === '' || value == null ? undefined : Number(value)),
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Próx. vencimento</label>
                  <input
                    type="date"
                    className="input-field"
                    {...dividaForm.register('data_prox_vencimento')}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={handleSkip} className="btn-ghost flex-1 text-sm">
                  Pular
                </button>
                <button
                  type="submit"
                  disabled={dividaForm.formState.isSubmitting}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {dividaForm.formState.isSubmitting && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Próximo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Etapa 2: Conclusão */}
        {step === 2 && (
          <div className="card p-8 text-center space-y-4">
            <CheckCircle size={48} className="text-success-500 mx-auto" />
            <div>
              <h2 className="text-lg font-bold text-gray-800">Tudo pronto!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Seu perfil financeiro está configurado. Agora você pode gerar seu plano de ação
                personalizado com IA.
              </p>
            </div>
            <button onClick={handleFinish} className="btn-primary w-full">
              Ir para o painel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
