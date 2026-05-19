import { useRef, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Plus, Trash2, Loader2, Upload,
  TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, FileText, Copy, Check, X,
} from 'lucide-react'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { EmptyState } from '@/components/ui/EmptyState'

/* ─── Tipos ─── */
interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  data: string
  categoria: string | null
  origem: string
  ofx_id: string | null
}

interface ContaLancamentosData {
  lancamentos: Lancamento[]
  saldo_inicial: number
  saldo_atual: number
  nome: string
  banco: string
  cor: string
  tipo: string
}

/* ─── Schema ─── */
const lancamentoSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  tipo: z.enum(['entrada', 'saida']),
  data: z.string().min(1, 'Data obrigatória'),
  categoria: z.string().optional(),
})
type LancamentoForm = z.infer<typeof lancamentoSchema>

const CATEGORIAS_CONTA = [
  'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação',
  'Lazer', 'Salário', 'Transferência', 'Investimento', 'Outros',
]

/* ─── Modal novo lançamento ─── */
function NovoLancamentoModal({
  contaId,
  onClose,
  onSuccess,
}: {
  contaId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [erro, setErro] = useState('')
  const {
    register, handleSubmit, watch, formState: { errors, isSubmitting },
  } = useForm<LancamentoForm>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: { tipo: 'saida', data: new Date().toISOString().split('T')[0] },
  })
  const tipoSelecionado = watch('tipo')

  async function onSubmit(data: LancamentoForm) {
    try {
      setErro('')
      await api.post(`/contas-bancarias/${contaId}/lancamentos`, data)
      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErro(msg ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <ModalDialog title="Novo lançamento" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
          {/* Tipo */}
          <div className="flex gap-2">
            {(['entrada', 'saida'] as const).map((t) => (
              <label key={t} className="flex-1">
                <input type="radio" value={t} className="sr-only" {...register('tipo')} />
                <span className={`block text-center py-2 rounded-xl text-sm font-medium cursor-pointer border-2 transition-all ${
                  t === 'entrada'
                    ? tipoSelecionado === 'entrada'
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-green-400 text-green-700 bg-white'
                    : tipoSelecionado === 'saida'
                      ? 'border-red-500 bg-red-500 text-white'
                      : 'border-red-400 text-red-700 bg-white'
                }`}>
                  {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                </span>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" className={`input-field ${errors.descricao ? 'border-danger-500' : ''}`}
              placeholder="Ex.: Supermercado" {...register('descricao')} />
            {errors.descricao && <p className="text-xs text-danger-600 mt-1">{errors.descricao.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input type="number" step="0.01" min="0.01" className={`input-field ${errors.valor ? 'border-danger-500' : ''}`}
                placeholder="0,00" {...register('valor')} />
              {errors.valor && <p className="text-xs text-danger-600 mt-1">{errors.valor.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" className={`input-field ${errors.data ? 'border-danger-500' : ''}`} {...register('data')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria (opcional)</label>
            <select className="input-field" {...register('categoria')}>
              <option value="">Sem categoria</option>
              {CATEGORIAS_CONTA.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {erro && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erro}</p>}
          <button type="submit" disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            Adicionar lançamento
          </button>
        </form>
    </ModalDialog>
  )
}

/* ─── Modal importar OFX ─── */
function ImportarOFXModal({
  contaId,
  onClose,
  onSuccess,
}: {
  contaId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<{ importados: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImportar() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setErro('Selecione um arquivo OFX.'); return }
    setErro('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('arquivo', file)
      const res = await api.post(`/contas-bancarias/${contaId}/importar-ofx`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResultado(res.data)
      onSuccess()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErro(msg ?? 'Erro ao importar. Verifique o arquivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalDialog title="Importar extrato OFX" onClose={onClose}>
      <div className="p-4 space-y-4">
          {resultado ? (
            <div className="text-center py-4">
              <p className="text-2xl font-bold text-success-600">{resultado.importados}</p>
              <p className="text-sm text-gray-600 mt-1">
                lançamentos importados de {resultado.total} no arquivo
              </p>
              {resultado.importados < resultado.total && (
                <p className="text-xs text-gray-400 mt-1">
                  ({resultado.total - resultado.importados} já existiam — ignorados)
                </p>
              )}
              <button onClick={onClose} className="btn-primary mt-4 px-6">Fechar</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Importe o extrato bancário no formato OFX/QFX. Lançamentos duplicados serão ignorados automaticamente.
              </p>
              <label className="block">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 transition-colors">
                  <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Clique para selecionar o arquivo</p>
                  <p className="text-xs text-gray-400 mt-1">.ofx, .qfx</p>
                </div>
                <input ref={fileRef} type="file" accept=".ofx,.qfx,.OFX,.QFX" className="hidden" />
              </label>
              {erro && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erro}</p>}
              <button onClick={handleImportar} disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={16} />}
                Importar extrato
              </button>
            </>
          )}
        </div>
    </ModalDialog>
  )
}

/* ─── Modal Extrato ─── */
function ExtratoContaModal({
  lancamentos,
  saldoInicial,
  nomeConta,
  onClose,
}: {
  lancamentos: Lancamento[]
  saldoInicial: number
  nomeConta: string
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

  // Lançamentos do mês filtrado, ordem cronológica
  const doMes = useMemo(
    () => lancamentos
      .filter((l) => l.data.slice(0, 7) === mesFiltro)
      .sort((a, b) => a.data.localeCompare(b.data)),
    [lancamentos, mesFiltro]
  )

  // Saldo acumulado até o início do mês filtrado (todos os lançamentos anteriores)
  const saldoAntesDoMes = useMemo(
    () => lancamentos
      .filter((l) => l.data.slice(0, 7) < mesFiltro)
      .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), saldoInicial),
    [lancamentos, mesFiltro, saldoInicial]
  )

  // Saldo acumulado linha a linha
  const linhas = useMemo(
    () => doMes.reduce<{ lancamento: Lancamento; saldo: number }[]>((acc, l) => {
      const anterior = acc.length > 0 ? acc[acc.length - 1].saldo : saldoAntesDoMes
      acc.push({ lancamento: l, saldo: anterior + (l.tipo === 'entrada' ? l.valor : -l.valor) })
      return acc
    }, []),
    [doMes, saldoAntesDoMes]
  )

  const { totalEntradas, totalSaidas } = useMemo(() => ({
    totalEntradas: doMes.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0),
    totalSaidas: doMes.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0),
  }), [doMes])

  function copiarCSV() {
    const header = 'Data;Descrição;Tipo;Valor;Categoria;Saldo'
    const rows = linhas.map(({ lancamento: l, saldo }) =>
      [
        l.data.split('-').reverse().join('/'),
        l.descricao,
        l.tipo === 'entrada' ? 'Entrada' : 'Saída',
        (l.tipo === 'entrada' ? l.valor : -l.valor).toFixed(2).replace('.', ','),
        l.categoria ?? '',
        saldo.toFixed(2).replace('.', ','),
      ].join(';')
    )
    navigator.clipboard.writeText([header, ...rows].join('\n'))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-gray-800">Extrato — {nomeConta}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Saldo acumulado por lançamento</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Filtro de mês */}
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
            title="Copiar como CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
          >
            {copiado ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copiado ? 'Copiado!' : 'CSV'}
          </button>
        </div>

        {/* Resumo do mês */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b shrink-0 text-center">
          <div>
            <p className="text-xs text-gray-400">Saldo anterior</p>
            <p className={`text-sm font-bold ${saldoAntesDoMes >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
              {formatCurrency(saldoAntesDoMes)}
            </p>
          </div>
          <div>
            <p className="text-xs text-green-600">+ Entradas</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(totalEntradas)}</p>
          </div>
          <div>
            <p className="text-xs text-red-500">− Saídas</p>
            <p className="text-sm font-bold text-red-500">{formatCurrency(totalSaidas)}</p>
          </div>
        </div>

        {/* Lista com saldo acumulado */}
        <div className="overflow-y-auto flex-1 p-4">
          {doMes.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Nenhum lançamento neste mês</p>
          ) : (
            <div className="space-y-1.5">
              {/* Linha de saldo anterior */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                <span className="font-medium">Saldo anterior ao mês</span>
                <span className={`font-bold ${saldoAntesDoMes >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                  {formatCurrency(saldoAntesDoMes)}
                </span>
              </div>
              {linhas.map(({ lancamento: l, saldo }) => (
                <div key={l.id} className="flex items-center gap-2 py-2 px-3 rounded-xl border border-gray-100 bg-white">
                  <div className={`w-1.5 h-8 rounded-full shrink-0 ${l.tipo === 'entrada' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.descricao}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-gray-400">{l.data.split('-').reverse().join('/')}</p>
                      {l.categoria && <span className="text-xs text-gray-400">· {l.categoria}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${l.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {l.tipo === 'entrada' ? '+' : '−'}{formatCurrency(l.valor)}
                    </p>
                    <p className={`text-xs ${saldo >= 0 ? 'text-gray-500' : 'text-red-500'}`}>
                      {formatCurrency(saldo)}
                    </p>
                  </div>
                </div>
              ))}
              {/* Saldo final */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl text-xs">
                <span className="font-semibold text-gray-600">Saldo final do mês</span>
                <span className={`font-bold text-sm ${(linhas[linhas.length - 1]?.saldo ?? 0) >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                  {formatCurrency(linhas[linhas.length - 1]?.saldo ?? saldoAntesDoMes)}
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
export default function ContaLancamentosPage() {
  const { contaId } = useParams<{ contaId: string }>()
  const queryClient = useQueryClient()
  const [showNovo, setShowNovo] = useState(false)
  const [showOFX, setShowOFX] = useState(false)
  const [showExtrato, setShowExtrato] = useState(false)

  const queryKey = ['conta-lancamentos', contaId]
  const { data, isLoading, isError } = useQuery<ContaLancamentosData>({
    queryKey,
    queryFn: () => api.get(`/contas-bancarias/${contaId}/lancamentos`).then((r) => r.data),
    enabled: !!contaId,
    retry: 1,
    staleTime: 5 * 60_000,
  })

  const deletar = useMutation({
    mutationFn: (lancamentoId: string) =>
      api.delete(`/contas-bancarias/${contaId}/lancamentos/${lancamentoId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  function handleDelete(id: string) {
    if (confirm('Remover este lançamento?')) deletar.mutate(id)
  }

  function onRefresh() {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] })
  }

  const lancamentos = data?.lancamentos ?? []
  const saldoPositivo = (data?.saldo_atual ?? 0) >= 0

  // Agrupar por mês
  const porMes = useMemo(() => lancamentos.reduce<Record<string, Lancamento[]>>((acc, l) => {
    const mes = l.data.slice(0, 7) // YYYY-MM
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
          <div
            className="flex-1 rounded-xl p-3 text-white"
            style={{ backgroundColor: data.cor }}
          >
            <p className="text-xs opacity-80">{data.banco}</p>
            <p className="font-semibold">{data.nome}</p>
            <div className="flex items-end justify-between mt-1">
              <div>
                <p className="text-xs opacity-70">Saldo atual</p>
                <p className={`text-xl font-bold ${saldoPositivo ? '' : 'text-red-200'}`}>
                  {formatCurrency(data.saldo_atual)}
                </p>
              </div>
              {data.saldo_inicial !== data.saldo_atual && (
                <p className="text-xs opacity-60">Inicial: {formatCurrency(data.saldo_inicial)}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resumo */}
      {lancamentos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-600 shrink-0" />
            <div>
              <p className="text-xs text-green-700">Entradas</p>
              <p className="font-bold text-green-700">
                {formatCurrency(lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0))}
              </p>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <TrendingDown size={16} className="text-red-600 shrink-0" />
            <div>
              <p className="text-xs text-red-700">Saídas</p>
              <p className="font-bold text-red-700">
                {formatCurrency(lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowNovo(true)}
          className="btn-primary flex items-center gap-2 py-2 px-3 text-sm flex-1 justify-center"
        >
          <Plus size={16} /> Novo lançamento
        </button>
        <button
          onClick={() => setShowOFX(true)}
          className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm"
        >
          <Upload size={16} /> OFX
        </button>
        <button
          onClick={() => setShowExtrato(true)}
          disabled={lancamentos.length === 0}
          className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm disabled:opacity-40"
        >
          <FileText size={16} /> Extrato
        </button>
      </div>

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
            onClick={() => queryClient.invalidateQueries({ queryKey })}
            className="mt-3 text-sm text-primary-600 underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : lancamentos.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhum lançamento ainda"
          description="Adicione entradas e saídas manualmente ou importe um extrato OFX"
        />
      ) : (
        <div className="space-y-4">
          {mesesOrdenados.map((mes) => (
            <div key={mes}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{formatMes(mes)}</p>
              <div className="space-y-2">
                {porMes[mes].map((l) => (
                  <div
                    key={l.id}
                    className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 flex items-center gap-3 shadow-sm"
                  >
                    <div className={`p-1.5 rounded-lg ${l.tipo === 'entrada' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {l.tipo === 'entrada'
                        ? <ArrowUpCircle size={16} className="text-green-600" />
                        : <ArrowDownCircle size={16} className="text-red-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{l.descricao}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">{l.data.split('-').reverse().join('/')}</p>
                        {l.categoria && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{l.categoria}</span>
                        )}
                        {l.origem === 'ofx' && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">OFX</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${l.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {l.tipo === 'entrada' ? '+' : '-'}{formatCurrency(l.valor)}
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

      {showNovo && (
        <NovoLancamentoModal
          contaId={contaId!}
          onClose={() => setShowNovo(false)}
          onSuccess={onRefresh}
        />
      )}
      {showOFX && (
        <ImportarOFXModal
          contaId={contaId!}
          onClose={() => setShowOFX(false)}
          onSuccess={onRefresh}
        />
      )}
      {showExtrato && (
        <ExtratoContaModal
          lancamentos={lancamentos}
          saldoInicial={data?.saldo_inicial ?? 0}
          nomeConta={data?.nome ?? ''}
          onClose={() => setShowExtrato(false)}
        />
      )}
    </div>
  )
}
