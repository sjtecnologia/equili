import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Plus, Trash2, Loader2, X, ShoppingCart, Wallet,
} from 'lucide-react'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'

/* ─── Tipos ─── */
interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: 'compra' | 'pagamento'
  data: string
  categoria: string | null
}

interface CartaoLancamentosData {
  lancamentos: Lancamento[]
  limite_total: number
  limite_disponivel: number
  limite_usado: number
  nome: string
  bandeira: string
  cor: string
  dia_fechamento: number
  dia_vencimento: number
}

/* ─── Schema ─── */
const lancamentoSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  tipo: z.enum(['compra', 'pagamento']),
  data: z.string().min(1, 'Data obrigatória'),
  categoria: z.string().optional(),
})
type LancamentoForm = z.infer<typeof lancamentoSchema>

const CATEGORIAS = [
  'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação',
  'Lazer', 'Assinaturas', 'Vestuário', 'Viagem', 'Outros',
]

/* ─── Modal ─── */
function LancamentoCartaoModal({
  cartaoId,
  tipoInicial,
  onClose,
  onSuccess,
}: {
  cartaoId: string
  tipoInicial: 'compra' | 'pagamento'
  onClose: () => void
  onSuccess: () => void
}) {
  const [erro, setErro] = useState('')
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<LancamentoForm>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      tipo: tipoInicial,
      data: new Date().toISOString().split('T')[0],
      descricao: tipoInicial === 'pagamento' ? 'Pagamento de fatura' : '',
    },
  })

  async function onSubmit(data: LancamentoForm) {
    try {
      setErro('')
      await api.post(`/cartoes-credito/${cartaoId}/lancamentos`, data)
      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErro(msg ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  const isPagamento = tipoInicial === 'pagamento'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">
            {isPagamento ? 'Pagar fatura' : 'Nova compra'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
          <input type="hidden" {...register('tipo')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" className={`input-field ${errors.descricao ? 'border-danger-500' : ''}`}
              placeholder={isPagamento ? 'Pagamento de fatura' : 'Ex.: Mercado Livre'}
              {...register('descricao')} />
            {errors.descricao && <p className="text-xs text-danger-600 mt-1">{errors.descricao.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input type="number" step="0.01" min="0.01"
                className={`input-field ${errors.valor ? 'border-danger-500' : ''}`}
                placeholder="0,00" {...register('valor')} />
              {errors.valor && <p className="text-xs text-danger-600 mt-1">{errors.valor.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" className="input-field" {...register('data')} />
            </div>
          </div>
          {!isPagamento && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria (opcional)</label>
              <select className="input-field" {...register('categoria')}>
                <option value="">Sem categoria</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {erro && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erro}</p>}
          <button type="submit" disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white transition-colors ${
              isPagamento ? 'bg-success-500 hover:bg-success-600' : 'bg-primary-500 hover:bg-primary-600'
            }`}>
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {isPagamento ? 'Registrar pagamento' : 'Adicionar compra'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ─── Página principal ─── */
export default function CartaoLancamentosPage() {
  const { cartaoId } = useParams<{ cartaoId: string }>()
  const queryClient = useQueryClient()
  const [modalTipo, setModalTipo] = useState<'compra' | 'pagamento' | null>(null)

  const queryKey = ['cartao-lancamentos', cartaoId]
  const { data, isLoading } = useQuery<CartaoLancamentosData>({
    queryKey,
    queryFn: () => api.get(`/cartoes-credito/${cartaoId}/lancamentos`).then((r) => r.data),
    enabled: !!cartaoId,
  })

  const deletar = useMutation({
    mutationFn: (lancamentoId: string) =>
      api.delete(`/cartoes-credito/${cartaoId}/lancamentos/${lancamentoId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  function handleDelete(id: string) {
    if (confirm('Remover este lançamento?')) deletar.mutate(id)
  }

  function onRefresh() {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['cartoes-credito'] })
  }

  const lancamentos = data?.lancamentos ?? []
  const percentUsado = data ? Math.min(100, (data.limite_usado / data.limite_total) * 100) : 0

  // Agrupar por mês
  const porMes = lancamentos.reduce<Record<string, Lancamento[]>>((acc, l) => {
    const mes = l.data.slice(0, 7)
    if (!acc[mes]) acc[mes] = []
    acc[mes].push(l)
    return acc
  }, {})
  const mesesOrdenados = Object.keys(porMes).sort().reverse()

  function formatMes(yyyyMm: string) {
    const [y, m] = yyyyMm.split('-')
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${meses[parseInt(m) - 1]} ${y}`
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/contas-bancarias" className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
          <ArrowLeft size={20} />
        </Link>
        {data && (
          <div className="flex-1 rounded-xl p-3 text-white" style={{ backgroundColor: data.cor }}>
            <p className="text-xs opacity-80 capitalize">{data.bandeira}</p>
            <p className="font-semibold">{data.nome}</p>
            <p className="text-xs opacity-70 mt-0.5">
              Fecha dia {data.dia_fechamento} · Vence dia {data.dia_vencimento}
            </p>
          </div>
        )}
      </div>

      {/* Limite */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Limite disponível</span>
            <span className={`font-bold ${percentUsado > 80 ? 'text-red-600' : 'text-success-600'}`}>
              {formatCurrency(data.limite_disponivel)}
            </span>
          </div>
          {/* Barra de progresso */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${percentUsado > 80 ? 'bg-red-500' : percentUsado > 60 ? 'bg-amber-400' : 'bg-success-500'}`}
              style={{ width: `${percentUsado}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>Usado: {formatCurrency(data.limite_usado)}</span>
            <span>Total: {formatCurrency(data.limite_total)}</span>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setModalTipo('compra')}
          className="btn-primary flex items-center gap-2 py-2 px-3 text-sm flex-1 justify-center"
        >
          <ShoppingCart size={16} /> Nova compra
        </button>
        <button
          onClick={() => setModalTipo('pagamento')}
          className="bg-success-500 hover:bg-success-600 text-white flex items-center gap-2 py-2 px-3 text-sm rounded-xl font-semibold transition-colors"
        >
          <Wallet size={16} /> Pagar fatura
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary-500" size={28} />
        </div>
      ) : lancamentos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma movimentação ainda</p>
          <p className="text-sm mt-1">Registre compras ou pagamentos de fatura</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mesesOrdenados.map((mes) => (
            <div key={mes}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{formatMes(mes)}</p>
                <p className="text-xs text-gray-400">
                  Compras: {formatCurrency(porMes[mes].filter(l => l.tipo === 'compra').reduce((s, l) => s + l.valor, 0))}
                </p>
              </div>
              <div className="space-y-2">
                {porMes[mes].map((l) => (
                  <div
                    key={l.id}
                    className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 flex items-center gap-3 shadow-sm"
                  >
                    <div className={`p-1.5 rounded-lg ${l.tipo === 'pagamento' ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {l.tipo === 'pagamento'
                        ? <Wallet size={16} className="text-green-600" />
                        : <ShoppingCart size={16} className="text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{l.descricao}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">{l.data.split('-').reverse().join('/')}</p>
                        {l.categoria && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{l.categoria}</span>
                        )}
                        {l.tipo === 'pagamento' && (
                          <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">Pagamento</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${l.tipo === 'pagamento' ? 'text-green-600' : 'text-gray-800'}`}>
                        {l.tipo === 'pagamento' ? '+' : '-'}{formatCurrency(l.valor)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="p-1.5 text-gray-300 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalTipo && (
        <LancamentoCartaoModal
          cartaoId={cartaoId!}
          tipoInicial={modalTipo}
          onClose={() => setModalTipo(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}
