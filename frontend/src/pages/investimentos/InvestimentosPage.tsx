import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Pencil, Trash2, Loader2, PieChart } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/utils/format'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Investimento {
  id: string
  nome: string
  tipo: string
  instituicao: string | null
  quantidade: number | null
  preco_medio: number | null
  valor_investido: number
  valor_atual: number
  rentabilidade_pct: number
  data_aplicacao: string
  observacao: string | null
}

interface CarteiraResumo {
  total_investido: number
  total_atual: number
  rentabilidade_pct: number
  por_tipo: Record<string, number>
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome'),
  tipo: z.enum(['acoes', 'fii', 'renda_fixa', 'criptomoeda', 'tesouro', 'outro']),
  instituicao: z.string().optional(),
  quantidade: z.number().optional(),
  preco_medio: z.number().optional(),
  valor_investido: z.number({ invalid_type_error: 'Informe o valor' }).positive('Deve ser maior que zero'),
  valor_atual: z.number({ invalid_type_error: 'Informe o valor' }).min(0),
  data_aplicacao: z.string().min(1, 'Informe a data'),
  observacao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ─── Labels ──────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  acoes: 'Ações',
  fii: 'FII',
  renda_fixa: 'Renda Fixa',
  criptomoeda: 'Criptomoeda',
  tesouro: 'Tesouro Direto',
  outro: 'Outro',
}

const TIPO_COLORS: Record<string, string> = {
  acoes: 'bg-blue-100 text-blue-700',
  fii: 'bg-purple-100 text-purple-700',
  renda_fixa: 'bg-green-100 text-green-700',
  criptomoeda: 'bg-orange-100 text-orange-700',
  tesouro: 'bg-teal-100 text-teal-700',
  outro: 'bg-gray-100 text-gray-600',
}

function brl(v: number) {
  return formatCurrency(v)
}

// ─── Modal de Formulário ──────────────────────────────────────────────────────

function InvestimentoModal({
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
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErroForm(detail ?? 'Erro ao salvar. Tente novamente.')
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestimentosPage() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Investimento | null>(null)

  const headers = { Authorization: `Bearer ${token}` }

  const { data: resumo } = useQuery<CarteiraResumo>({
    queryKey: ['investimentos-resumo'],
    queryFn: () => api.get('/investimentos/resumo', { headers }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: lista = [], isLoading } = useQuery<Investimento[]>({
    queryKey: ['investimentos'],
    queryFn: () => api.get('/investimentos', { headers }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const deletar = useMutation({
    mutationFn: (id: string) => api.delete(`/investimentos/${id}`, { headers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investimentos'] })
      qc.invalidateQueries({ queryKey: ['investimentos-resumo'] })
    },
  })

  const abrirEdicao = (inv: Investimento) => {
    setEditando(inv)
    setModal(true)
  }

  const fecharModal = () => {
    setModal(false)
    setEditando(null)
  }

  const rentPos = (resumo?.rentabilidade_pct ?? 0) >= 0
  const tiposOrdenados = useMemo(
    () => Object.entries(resumo?.por_tipo ?? {}).sort(([, a], [, b]) => b - a),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resumo?.por_tipo]
  )

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Investimentos"
        subtitle="Acompanhe sua carteira"
        action={{ label: 'Adicionar', onClick: () => { setEditando(null); setModal(true) } }}
      />

      {/* Cards de resumo */}
      {resumo && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Total investido</p>
            <p className="text-lg font-bold text-gray-800">{brl(resumo.total_investido)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Valor atual</p>
            <p className="text-lg font-bold text-gray-800">{brl(resumo.total_atual)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Rentabilidade</p>
            <div className="flex items-center gap-1">
              {rentPos ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-red-500" />}
              <p className={`text-lg font-bold ${rentPos ? 'text-green-600' : 'text-red-500'}`}>
                {rentPos ? '+' : ''}{resumo.rentabilidade_pct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Distribuição por tipo */}
      {resumo && Object.keys(resumo.por_tipo).length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={16} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-700">Distribuição por tipo</h2>
          </div>
          <div className="space-y-2">
            {tiposOrdenados.map(([tipo, valor]) => {
                const pct = resumo.total_atual > 0 ? (valor / resumo.total_atual) * 100 : 0
                return (
                  <div key={tipo}>
                    <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                      <span>{TIPO_LABELS[tipo] ?? tipo}</span>
                      <span>{brl(valor)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-indigo-500" size={24} />
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhum investimento cadastrado ainda."
          description="Adicione suas posições para acompanhar sua carteira."
          action={{ label: 'Adicionar investimento', onClick: () => { setEditando(null); setModal(true) } }}
        />
      ) : (
        <div className="space-y-3">
          {lista.map((inv) => {
            const pos = inv.rentabilidade_pct >= 0
            return (
              <div key={inv.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 truncate">{inv.nome}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[inv.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TIPO_LABELS[inv.tipo] ?? inv.tipo}
                      </span>
                    </div>
                    {inv.instituicao && <p className="text-xs text-gray-400 mt-0.5">{inv.instituicao}</p>}
                    <div className="flex gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">Investido</span>
                        <p className="font-medium text-gray-700">{brl(inv.valor_investido)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Atual</span>
                        <p className="font-medium text-gray-700">{brl(inv.valor_atual)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Rentabilidade</span>
                        <p className={`font-semibold ${pos ? 'text-green-600' : 'text-red-500'}`}>
                          {pos ? '+' : ''}{inv.rentabilidade_pct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => abrirEdicao(inv)} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => { if (confirm('Remover este investimento?')) deletar.mutate(inv.id) }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && <InvestimentoModal onClose={fecharModal} editando={editando} />}
    </div>
  )
}
