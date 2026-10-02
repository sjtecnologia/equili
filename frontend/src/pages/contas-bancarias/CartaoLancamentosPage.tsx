import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft, Trash2, Loader2, X, ShoppingCart, Wallet, FileText, Copy, Check,
} from 'lucide-react'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'
import { parseApiError } from '@/utils/api'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { FiltrosBarra, limparFiltrosVazios, CAMPOS_PERIODO, type CampoFiltro } from '@/components/shared/FiltrosBarra'
import { lancamentoCartaoSchema } from '@/lib/schemas/financeiro'
import type { LancamentoCartaoFormData } from '@/lib/schemas/financeiro'
import type { CartaoLancamento as Lancamento } from '@/types/financeiro'
import { useCartaoLancamentos } from '@/hooks/useCartaoLancamentos'

/* ─── Schema ─── */
const lancamentoSchema = lancamentoCartaoSchema
type LancamentoForm = LancamentoCartaoFormData

const CATEGORIAS = [
  'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação',
  'Lazer', 'Assinaturas', 'Vestuário', 'Viagem', 'Outros',
]

const CAMPOS_FILTRO: CampoFiltro[] = [
  { key: 'q', tipo: 'busca', placeholder: 'Buscar (descrição)' },
  { key: 'tipo', tipo: 'select', label: 'Tipo', opcoes: [{ value: 'compra', label: 'Compra' }, { value: 'pagamento', label: 'Pagamento' }] },
  {
    key: 'categoria', tipo: 'select', label: 'Categoria', todasLabel: 'Todas',
    opcoes: CATEGORIAS.map((c) => ({ value: c, label: c })),
  },
  ...CAMPOS_PERIODO,
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
      setErro(parseApiError(e) ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  const isPagamento = tipoInicial === 'pagamento'

  return (
    <ModalDialog title={isPagamento ? 'Pagar fatura' : 'Nova compra'} onClose={onClose}>
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
    </ModalDialog>
  )
}

/* ─── Modal Extrato Cartão ─── */
function ExtratoCartaoModal({
  lancamentos,
  nomeCartao,
  diaFechamento,
  onClose,
}: {
  lancamentos: Lancamento[]
  nomeCartao: string
  diaFechamento: number
  onClose: () => void
}) {
  const mesesDisponiveis = useMemo(
    () => [...new Set(lancamentos.map((l) => l.data.slice(0, 7)))].sort().reverse(),
    [lancamentos]
  )
  const [mesFiltro, setMesFiltro] = useState(() =>
    [...new Set(lancamentos.map((l) => l.data.slice(0, 7)))].sort().reverse()[0] ?? ''
  )
  const [copiado, setCopiado] = useState(false)

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  function formatMesLabel(ym: string) {
    const [y, m] = ym.split('-')
    return `${MESES[parseInt(m) - 1]}/${y}`
  }

  const doMes = useMemo(
    () => lancamentos
      .filter((l) => l.data.slice(0, 7) === mesFiltro)
      .sort((a, b) => a.data.localeCompare(b.data)),
    [lancamentos, mesFiltro]
  )

  const { totalCompras, totalPagamentos } = useMemo(() => ({
    totalCompras: doMes.filter((l) => l.tipo === 'compra').reduce((s, l) => s + l.valor, 0),
    totalPagamentos: doMes.filter((l) => l.tipo === 'pagamento').reduce((s, l) => s + l.valor, 0),
  }), [doMes])
  const saldoFatura = useMemo(() => totalCompras - totalPagamentos, [totalCompras, totalPagamentos])

  // Dia de fechamento da fatura
  const fechamentoLabel = useMemo(() => {
    if (!mesFiltro) return ''
    const [y, m] = mesFiltro.split('-').map(Number)
    const dia = String(diaFechamento).padStart(2, '0')
    const mes = String(m).padStart(2, '0')
    return `Fecha dia ${dia}/${mes}/${y}`
  }, [mesFiltro, diaFechamento])

  function copiarCSV() {
    const header = 'Data;Descrição;Tipo;Valor;Categoria'
    const rows = doMes.map((l) =>
      [
        l.data.split('-').reverse().join('/'),
        l.descricao,
        l.tipo === 'compra' ? 'Compra' : 'Pagamento',
        (l.tipo === 'compra' ? l.valor : -l.valor).toFixed(2).replace('.', ','),
        l.categoria ?? '',
      ].join(';')
    )
    navigator.clipboard.writeText([header, ...rows].join('\n'))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-gray-800">Extrato — {nomeCartao}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fechamentoLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Filtro */}
        <div className="px-4 py-3 border-b shrink-0 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600 shrink-0">Mês:</label>
          <select
            className="input-field flex-1 text-sm py-1.5"
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
          >
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>{formatMesLabel(m)}</option>
            ))}
          </select>
          <button
            onClick={copiarCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
          >
            {copiado ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copiado ? 'Copiado!' : 'CSV'}
          </button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b shrink-0 text-center">
          <div>
            <p className="text-xs text-gray-500">Compras</p>
            <p className="text-sm font-bold text-red-600">{formatCurrency(totalCompras)}</p>
          </div>
          <div>
            <p className="text-xs text-green-600">Pagamentos</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(totalPagamentos)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fatura</p>
            <p className={`text-sm font-bold ${saldoFatura > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(saldoFatura))}
            </p>
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 p-4">
          {doMes.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Nenhum lançamento neste mês</p>
          ) : (
            <div className="space-y-1.5">
              {doMes.map((l) => (
                <div key={l.id} className="flex items-center gap-2 py-2 px-3 rounded-xl border border-gray-100 bg-white">
                  <div className={`w-1.5 h-8 rounded-full shrink-0 ${l.tipo === 'pagamento' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.descricao}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-gray-400">{l.data.split('-').reverse().join('/')}</p>
                      {l.categoria && <span className="text-xs text-gray-400">· {l.categoria}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${l.tipo === 'pagamento' ? 'text-green-600' : 'text-red-600'}`}>
                      {l.tipo === 'pagamento' ? '−' : '+'}{formatCurrency(l.valor)}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{l.tipo}</p>
                  </div>
                </div>
              ))}
              {/* Total fatura */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl text-xs">
                <span className="font-semibold text-gray-600">Total da fatura</span>
                <span className={`font-bold text-sm ${saldoFatura > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(saldoFatura)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Página principal ─── */
export default function CartaoLancamentosPage() {
  const { cartaoId } = useParams<{ cartaoId: string }>()
  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const temFiltro = Object.keys(filtros).length > 0
  const { data, completo, isLoading, isError, deletar, invalidate } = useCartaoLancamentos(cartaoId, filtros)
  const [modalTipo, setModalTipo] = useState<'compra' | 'pagamento' | null>(null)
  const [showExtrato, setShowExtrato] = useState(false)

  function handleDelete(id: string) {
    if (confirm('Remover este lançamento?')) deletar(id)
  }

  function onRefresh() {
    invalidate()
  }

  const lancamentos = data?.lancamentos ?? []
  const percentUsado = useMemo(
    () => data ? Math.min(100, (data.limite_usado / data.limite_total) * 100) : 0,
    [data]
  )

  // Agrupar por mês
  const porMes = useMemo(() => lancamentos.reduce<Record<string, Lancamento[]>>((acc, l) => {
    const mes = l.data.slice(0, 7)
    if (!acc[mes]) acc[mes] = []
    acc[mes].push(l)
    return acc
  }, {}), [lancamentos])
  const mesesOrdenados = useMemo(() => Object.keys(porMes).sort().reverse(), [porMes])

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
          <Wallet size={16} /> Pagar
        </button>
        <button
          onClick={() => setShowExtrato(true)}
          disabled={completo.length === 0}
          className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm disabled:opacity-40"
        >
          <FileText size={16} /> Extrato
        </button>
      </div>

      <FiltrosBarra campos={CAMPOS_FILTRO} onFiltrar={(f) => setFiltros(limparFiltrosVazios(f))} />

      {/* Lista */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Loader2 className="animate-spin text-primary-500" size={28} />
          <p className="text-sm text-gray-400">Carregando lançamentos...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-red-400">
          <p className="font-medium">Erro ao carregar lançamentos</p>
          <p className="text-sm mt-1">Verifique sua conexão e tente novamente</p>
          <button
            onClick={invalidate}
            className="mt-3 text-sm text-primary-600 underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : lancamentos.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={temFiltro ? 'Nenhuma movimentação encontrada para os filtros informados.' : 'Nenhuma movimentação ainda'}
          description={temFiltro ? undefined : 'Registre compras ou pagamentos de fatura'}
        />
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
      {showExtrato && (
        <ExtratoCartaoModal
          lancamentos={completo}
          nomeCartao={data?.nome ?? ''}
          diaFechamento={data?.dia_fechamento ?? 1}
          onClose={() => setShowExtrato(false)}
        />
      )}
    </div>
  )
}
