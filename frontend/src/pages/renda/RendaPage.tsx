import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, Loader2, Pencil, TrendingUp } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'

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

  async function onSubmit(data: FormData) {
    if (renda) {
      await api.patch(`/rendas/${renda.id}`, data)
    } else {
      await api.post('/rendas', data)
    }
    onSuccess()
    onClose()
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

export default function RendaPage() {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Renda | null>(null)
  const queryClient = useQueryClient()

  const { data: rendas = [], isLoading } = useQuery<Renda[]>({
    queryKey: ['rendas'],
    queryFn: () => api.get('/rendas').then((r) => r.data),
    staleTime: 5 * 60_000,
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
      <PageHeader
        title="Renda"
        subtitle="Suas fontes de renda"
        action={{ label: 'Adicionar', onClick: () => setShowModal(true) }}
      />

      {/* Total */}
      <div className="card bg-success-500 bg-opacity-10 border border-green-200 p-4">
        <p className="text-sm text-gray-600">Total mensal</p>
        <p className="text-2xl font-bold text-success-500">{formatCurrency(total)}</p>
      </div>

      {/* Lista */}
      {isLoading ? (
        <SkeletonList count={3} />
      ) : rendas.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhuma renda cadastrada."
          action={{ label: 'Adicionar primeira renda', onClick: () => setShowModal(true) }}
        />
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
                onClick={() => setEditando(renda)}
                className="text-gray-300 hover:text-primary-500 transition-colors"
                aria-label="Editar renda"
              >
                <Pencil size={16} />
              </button>
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
      {editando && (
        <RendaModal
          renda={editando}
          onClose={() => setEditando(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['rendas'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      )}
    </div>
  )
}
