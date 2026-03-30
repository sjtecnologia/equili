import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Download, TrendingUp, TrendingDown, Scale, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'

// ---------- Tipos ----------

interface FluxoMes {
  mes: number
  mes_nome: string
  ano: number
  entradas: number
  saidas: number
  saldo: number
}

interface ContaPagarItem {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_vencimento: string
  status: string
  tipo: string
  observacao: string | null
}

interface ContaReceberItem {
  id: string
  descricao: string
  origem: string
  valor: number
  data_prevista: string
  status: string
  tipo: string
  devedor: string | null
  observacao: string | null
}

interface RelatorioDetalhado {
  contas_pagar: ContaPagarItem[]
  contas_receber: ContaReceberItem[]
  totais: {
    total_pagar: number
    total_receber: number
    saldo: number
  }
}

// ---------- Constantes ----------

const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const CATEGORIAS_LABEL: Record<string, string> = {
  moradia: 'Moradia',
  transporte: 'Transporte',
  saude: 'Saúde',
  educacao: 'Educação',
  alimentacao: 'Alimentação',
  lazer: 'Lazer',
  outro: 'Outro',
}

const ORIGENS_LABEL: Record<string, string> = {
  salario: 'Salário',
  freela: 'Freelance',
  venda: 'Venda',
  emprestimo: 'Empréstimo',
  outro: 'Outro',
}

const STATUS_PAGAR: Record<string, { label: string; classes: string }> = {
  pendente: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  pago: { label: 'Pago', classes: 'bg-green-100 text-green-700' },
  vencido: { label: 'Vencido', classes: 'bg-red-100 text-red-700' },
}

const STATUS_RECEBER: Record<string, { label: string; classes: string }> = {
  pendente: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
  recebido: { label: 'Recebido', classes: 'bg-green-100 text-green-700' },
  atrasado: { label: 'Atrasado', classes: 'bg-red-100 text-red-700' },
}

// ---------- Tooltip customizado ----------

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// ---------- Exportação Excel ----------

function exportFluxoCaixaExcel(data: FluxoMes[], ano: number) {
  const rows = data.map((d) => ({
    'Mês': d.mes_nome,
    'Entradas (R$)': d.entradas,
    'Saídas (R$)': d.saidas,
    'Saldo (R$)': d.saldo,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa')
  XLSX.writeFile(wb, `fluxo_caixa_${ano}.xlsx`)
}

function exportDetalhadoExcel(data: RelatorioDetalhado, mes: number, ano: number) {
  const rowsResumo = [
    { 'Item': 'Total a Receber', 'Valor (R$)': data.totais.total_receber },
    { 'Item': 'Total a Pagar', 'Valor (R$)': data.totais.total_pagar },
    { 'Item': 'Saldo', 'Valor (R$)': data.totais.saldo },
  ]

  const rowsReceber = data.contas_receber.map((c) => ({
    'Descrição': c.descricao,
    'Origem': ORIGENS_LABEL[c.origem] ?? c.origem,
    'Valor (R$)': c.valor,
    'Data Prevista': c.data_prevista,
    'Status': STATUS_RECEBER[c.status]?.label ?? c.status,
    'Tipo': c.tipo,
    'Devedor': c.devedor ?? '',
    'Observação': c.observacao ?? '',
  }))

  const rowsPagar = data.contas_pagar.map((c) => ({
    'Descrição': c.descricao,
    'Categoria': CATEGORIAS_LABEL[c.categoria] ?? c.categoria,
    'Valor (R$)': c.valor,
    'Vencimento': c.data_vencimento,
    'Status': STATUS_PAGAR[c.status]?.label ?? c.status,
    'Tipo': c.tipo,
    'Observação': c.observacao ?? '',
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsResumo), 'Resumo')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsReceber), 'Contas a Receber')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsPagar), 'Contas a Pagar')
  XLSX.writeFile(wb, `relatorio_${ano}_${String(mes).padStart(2, '0')}.xlsx`)
}

// ---------- Componente principal ----------

export default function RelatoriosPage() {
  const [tab, setTab] = useState<'fluxo' | 'detalhado'>('fluxo')
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [anoFluxo, setAnoFluxo] = useState(currentYear)
  const [mesDetalhe, setMesDetalhe] = useState(currentMonth)
  const [anoDetalhe, setAnoDetalhe] = useState(currentYear)

  const years = [currentYear - 1, currentYear, currentYear + 1]

  const { data: fluxoData, isLoading: loadingFluxo } = useQuery<FluxoMes[]>({
    queryKey: ['fluxo-caixa', anoFluxo],
    queryFn: () => api.get(`/relatorio/fluxo-caixa?ano=${anoFluxo}`).then((r) => r.data),
  })

  const { data: detalhado, isLoading: loadingDetalhado } = useQuery<RelatorioDetalhado>({
    queryKey: ['relatorio-detalhado', mesDetalhe, anoDetalhe],
    queryFn: () =>
      api.get(`/relatorio/detalhado?mes=${mesDetalhe}&ano=${anoDetalhe}`).then((r) => r.data),
    enabled: tab === 'detalhado',
  })

  const chartData = fluxoData?.map((d) => ({ ...d, nome: MESES_ABR[d.mes - 1] })) ?? []
  const totalEntradas = fluxoData?.reduce((acc, d) => acc + d.entradas, 0) ?? 0
  const totalSaidas = fluxoData?.reduce((acc, d) => acc + d.saidas, 0) ?? 0
  const saldoAnual = totalEntradas - totalSaidas

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Relatórios</h1>
        <p className="text-sm text-gray-500">Análise financeira e exportação para Excel</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {[
          { key: 'fluxo', label: 'Fluxo de Caixa' },
          { key: 'detalhado', label: 'Relatório Detalhado' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'fluxo' | 'detalhado')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-white text-primary-500 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== Tab: Fluxo de Caixa ===== */}
      {tab === 'fluxo' && (
        <div className="space-y-4">
          {/* Controles */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Ano:</label>
              <select
                value={anoFluxo}
                onChange={(e) => setAnoFluxo(Number(e.target.value))}
                className="input-field w-24 py-1.5 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => fluxoData && exportFluxoCaixaExcel(fluxoData, anoFluxo)}
              disabled={!fluxoData || loadingFluxo}
              className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Download size={15} />
              Exportar Excel
            </button>
          </div>

          {/* Cards resumo anual */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-1">Total entradas</p>
              <p className="text-base font-bold text-success-500">{formatCurrency(totalEntradas)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-1">Total saídas</p>
              <p className="text-base font-bold text-danger-500">{formatCurrency(totalSaidas)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-1">Saldo anual</p>
              <p className={`text-base font-bold ${saldoAnual >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                {formatCurrency(saldoAnual)}
              </p>
            </div>
          </div>

          {/* Gráfico */}
          {loadingFluxo ? (
            <div className="card h-64 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Entradas vs Saídas — {anoFluxo}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) =>
                      v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                    tick={{ fontSize: 11 }}
                    width={56}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#e5e7eb" />
                  <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela mensal */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Mês
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-success-500 uppercase tracking-wide">
                    Entradas
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-danger-500 uppercase tracking-wide">
                    Saídas
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {(fluxoData ?? []).map((d) => (
                  <tr key={d.mes} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-700">{MESES_FULL[d.mes - 1]}</td>
                    <td className="px-4 py-3 text-right text-success-500 font-medium">
                      {formatCurrency(d.entradas)}
                    </td>
                    <td className="px-4 py-3 text-right text-danger-500 font-medium">
                      {formatCurrency(d.saidas)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        d.saldo >= 0 ? 'text-success-500' : 'text-danger-500'
                      }`}
                    >
                      {formatCurrency(d.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Tab: Relatório Detalhado ===== */}
      {tab === 'detalhado' && (
        <div className="space-y-4">
          {/* Controles */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Mês:</label>
              <select
                value={mesDetalhe}
                onChange={(e) => setMesDetalhe(Number(e.target.value))}
                className="input-field py-1.5 text-sm"
              >
                {MESES_FULL.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={anoDetalhe}
                onChange={(e) => setAnoDetalhe(Number(e.target.value))}
                className="input-field w-24 py-1.5 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => detalhado && exportDetalhadoExcel(detalhado, mesDetalhe, anoDetalhe)}
              disabled={!detalhado || loadingDetalhado}
              className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Download size={15} />
              Exportar Excel
            </button>
          </div>

          {loadingDetalhado ? (
            <div className="card h-32 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : detalhado ? (
            <>
              {/* Cards resumo do mês */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={13} className="text-success-500" />
                    <p className="text-xs text-gray-500">A receber</p>
                  </div>
                  <p className="text-base font-bold text-success-500">
                    {formatCurrency(detalhado.totais.total_receber)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {detalhado.contas_receber.length} lançamento(s)
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown size={13} className="text-danger-500" />
                    <p className="text-xs text-gray-500">A pagar</p>
                  </div>
                  <p className="text-base font-bold text-danger-500">
                    {formatCurrency(detalhado.totais.total_pagar)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {detalhado.contas_pagar.length} lançamento(s)
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Scale size={13} className="text-gray-500" />
                    <p className="text-xs text-gray-500">Saldo</p>
                  </div>
                  <p
                    className={`text-base font-bold ${
                      detalhado.totais.saldo >= 0 ? 'text-success-500' : 'text-danger-500'
                    }`}
                  >
                    {formatCurrency(detalhado.totais.saldo)}
                  </p>
                </div>
              </div>

              {/* Tabela: Contas a Receber */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <TrendingUp size={15} className="text-success-500" />
                  <h3 className="font-semibold text-gray-700">Contas a Receber</h3>
                  <span className="ml-auto text-xs text-gray-400">
                    {detalhado.contas_receber.length} registro(s)
                  </span>
                </div>
                {detalhado.contas_receber.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-400 text-center">
                    Nenhum lançamento neste mês.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Descrição</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Origem</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Valor</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Data</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhado.contas_receber.map((c) => (
                          <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-700 max-w-[150px] truncate">
                              {c.descricao}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">
                              {ORIGENS_LABEL[c.origem] ?? c.origem}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-success-500">
                              {formatCurrency(c.valor)}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                              {formatDate(c.data_prevista)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  STATUS_RECEBER[c.status]?.classes ?? 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {STATUS_RECEBER[c.status]?.label ?? c.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Tabela: Contas a Pagar */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <TrendingDown size={15} className="text-danger-500" />
                  <h3 className="font-semibold text-gray-700">Contas a Pagar</h3>
                  <span className="ml-auto text-xs text-gray-400">
                    {detalhado.contas_pagar.length} registro(s)
                  </span>
                </div>
                {detalhado.contas_pagar.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-400 text-center">
                    Nenhum lançamento neste mês.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Descrição</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Categoria</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Valor</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Vencimento</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhado.contas_pagar.map((c) => (
                          <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-700 max-w-[150px] truncate">
                              {c.descricao}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">
                              {CATEGORIAS_LABEL[c.categoria] ?? c.categoria}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-danger-500">
                              {formatCurrency(c.valor)}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                              {formatDate(c.data_vencimento)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  STATUS_PAGAR[c.status]?.classes ?? 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {STATUS_PAGAR[c.status]?.label ?? c.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
