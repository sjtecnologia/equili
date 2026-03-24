import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, X } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'

const FREQUENCIAS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'semanal', label: 'Semanal' },
]

const TIPOS = [
  { value: 'salario', label: 'Salário' },
  { value: 'freela', label: 'Freelance' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'outro', label: 'Outro' },
]

interface Renda {
  id: string
  descricao: string
  valor: number
  frequencia: string
  tipo: string
  ativo: boolean
}

const schema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  frequencia: z.string().min(1, 'Selecione a frequência'),
  tipo: z.string().min(1, 'Selecione o tipo'),
})

type FormData = z.infer<typeof schema>

function RendaModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { frequencia: 'mensal', tipo: 'salario' },
  })

  async function onSubmit(data: FormData) {
    await api.post('/rendas', data)
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">Nova entrada de renda</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
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
            <input
              type="number"
              step="0.01"
              min="0.01"
              className={`input-field ${errors.valor ? 'border-danger-500' : ''}`}
              placeholder="0,00"
              {...register('valor')}
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
      </div>
    </div>
  )
}

export default function RendaPage() {
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: rendas = [], isLoading } = useQuery<Renda[]>({
    queryKey: ['rendas'],
    queryFn: () => api.get('/rendas').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rendas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rendas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const total = rendas.reduce((acc, r) => acc + r.valor, 0)

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Renda</h1>
          <p className="text-sm text-gray-500">Suas fontes de renda</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          <span className="hidden sm:inline">Adicionar</span>
        </button>
      </div>

      {/* Total */}
      <div className="card bg-success-500 bg-opacity-10 border border-green-200 p-4">
        <p className="text-sm text-gray-600">Total mensal</p>
        <p className="text-2xl font-bold text-success-500">{formatCurrency(total)}</p>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : rendas.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 text-sm">Nenhuma renda cadastrada.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-primary-500 font-medium text-sm hover:underline"
          >
            Adicionar primeira renda
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rendas.map((renda) => (
            <div key={renda.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{renda.descricao}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {TIPOS.find((t) => t.value === renda.tipo)?.label ?? renda.tipo}
                  {' · '}
                  {FREQUENCIAS.find((f) => f.value === renda.frequencia)?.label ?? renda.frequencia}
                </p>
              </div>
              <p className="font-bold text-success-500 whitespace-nowrap">
                {formatCurrency(renda.valor)}
              </p>
              <button
                onClick={() => deleteMutation.mutate(renda.id)}
                disabled={deleteMutation.isPending}
                className="text-gray-300 hover:text-danger-500 transition-colors"
                aria-label="Excluir renda"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RendaModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['rendas'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      )}
    </div>
  )
}
