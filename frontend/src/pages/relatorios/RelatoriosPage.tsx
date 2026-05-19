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
import { Download, TrendingUp, TrendingDown, Scale, Loader2, FileText, Copy, Check, Printer } from 'lucide-react'
import * as XLSX from 'xlsx'
import { formatCurrency, formatDate } from '@/utils/format'
import { CATEGORIAS_LABEL, ORIGENS_LABEL, STATUS_PAGAR, STATUS_RECEBER } from '@/utils/labels'
import type { FluxoMes, RelatorioDetalhado, CartaoLancamento } from '@/types/financeiro'
import { useRelatorios } from '@/hooks/useRelatorios'

const MESES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

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
  const {
    tab, handleTabChange, years,
    anoFluxo, setAnoFluxo,
    fluxoData, loadingFluxo,
    chartData, totalEntradas, totalSaidas, saldoAnual,
    mesDetalhe, setMesDetalhe, anoDetalhe, setAnoDetalhe,
    detalhado, loadingDetalhado,
    dataDia, setDataDia, contasDia, loadingDia,
    tipoExtrato, trocarTipoExtrato,
    contaExtratoId, setContaExtratoId,
    cartaoExtratoId, setCartaoExtratoId,
    setMesExtrato, mesEfetivo,
    copiadoExtrato, setCopiadoExtrato,
    contasBancarias, cartoes,
    loadingContas, loadingCartoes, contasError, cartoesError,
    loadingConta, loadingCartao, contaLancamentosError, cartaoLancamentosError,
    lancamentosExtrato, lancamentosDoMes, mesesDisponiveisExtrato,
    saldoAntesDoMes, linhasConta,
    totalEntC, totalSaiC, totalCompras, totalPagamentosCartao,
  } = useRelatorios()

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 print:hidden">Relatórios</h1>
        <p className="text-sm text-gray-500 print:hidden">Análise financeira e exportação para Excel</p>
        {/* Título de impressão — visível apenas no print */}
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {tab === 'fluxo' && `Fluxo de Caixa — ${anoFluxo}`}
            {tab === 'detalhado' && `Relatório Detalhado — ${MESES_FULL[mesDetalhe - 1]}/${anoDetalhe}`}
            {tab === 'extrato' && 'Extrato Bancário'}
            {tab === 'dia' && `Contas a Pagar do Dia — ${dataDia.split('-').reverse().join('/')}`}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Equili · Impresso em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl print:hidden">
        {[
          { key: 'fluxo', label: 'Fluxo de Caixa' },
          { key: 'detalhado', label: 'Detalhado' },
          { key: 'extrato', label: 'Extrato' },
          { key: 'dia', label: 'Por Dia' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key as 'fluxo' | 'detalhado' | 'extrato' | 'dia')}
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
          <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Ano:</label>
              <select
                onChange={(e) => setAnoFluxo(Number(e.target.value))}
                className="input-field w-24 py-1.5 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={() => fluxoData && exportFluxoCaixaExcel(fluxoData, anoFluxo)}
                disabled={!fluxoData || loadingFluxo}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Download size={15} />
                Exportar Excel
              </button>
              <button
                onClick={() => window.print()}
                disabled={!fluxoData || loadingFluxo}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Printer size={15} />
                Imprimir
              </button>
            </div>
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
          <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Mês:</label>
              <select
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
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={() => detalhado && exportDetalhadoExcel(detalhado, mesDetalhe, anoDetalhe)}
                disabled={!detalhado || loadingDetalhado}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Download size={15} />
                Exportar Excel
              </button>
              <button
                onClick={() => window.print()}
                disabled={!detalhado || loadingDetalhado}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Printer size={15} />
                Imprimir
              </button>
            </div>
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

      {/* ===== Tab: Extrato Bancário ===== */}
      {tab === 'extrato' && (() => {
        const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
        const hasContas = contasBancarias.length > 0
        const hasCartoes = cartoes.length > 0
        const loadingListas = loadingContas || loadingCartoes
        const erroListas = contasError || cartoesError
        const isLoadingLancamentos = tipoExtrato === 'conta' ? loadingConta : loadingCartao
        const erroLancamentos = tipoExtrato === 'conta' ? contaLancamentosError : cartaoLancamentosError

        function copiarCSV() {
          if (tipoExtrato === 'conta') {
            const header = 'Data;Descrição;Tipo;Valor;Categoria;Saldo'
            const rows = linhasConta.map(({ lancamento: l, saldo }) =>
              [l.data.split('-').reverse().join('/'), l.descricao,
               l.tipo === 'entrada' ? 'Entrada' : 'Saída',
               (l.tipo === 'entrada' ? l.valor : -l.valor).toFixed(2).replace('.', ','),
               l.categoria ?? '', saldo.toFixed(2).replace('.', ',')].join(';')
            )
            navigator.clipboard.writeText([header, ...rows].join('\n'))
          } else {
            const header = 'Data;Descrição;Tipo;Valor;Categoria'
            const rows = (lancamentosDoMes as CartaoLancamento[]).map((l) =>
              [l.data.split('-').reverse().join('/'), l.descricao,
               l.tipo === 'compra' ? 'Compra' : 'Pagamento',
               (l.tipo === 'compra' ? l.valor : -l.valor).toFixed(2).replace('.', ','),
               l.categoria ?? ''].join(';')
            )
            navigator.clipboard.writeText([header, ...rows].join('\n'))
          }
          setCopiadoExtrato(true)
          setTimeout(() => setCopiadoExtrato(false), 2000)
        }

        return (
          <div className="space-y-4">
            {/* Info de impressão: conta/cartão e mês selecionados */}
            <div className="hidden print:block text-sm text-gray-500 -mt-2 mb-1">
              {tipoExtrato === 'conta'
                ? contasBancarias.find((c) => c.id === contaExtratoId)?.nome ?? ''
                : cartoes.find((c) => c.id === cartaoExtratoId)?.nome ?? ''}
              {' · '}
              {mesEfetivo ? (() => { const [y, mo] = mesEfetivo.split('-'); return `${MESES_LABEL[parseInt(mo)-1]}/${y}` })() : ''}
            </div>
            {/* Tipo conta/cartão */}
            <div className="flex gap-2 print:hidden">
              {(['conta', 'cartao'] as const).map((t) => (
                <button key={t}
                  onClick={() => trocarTipoExtrato(t)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    tipoExtrato === t
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-500'
                  }`}>
                  {t === 'conta' ? '🏦 Conta Bancária' : '💳 Cartão de Crédito'}
                </button>
              ))}
            </div>

            {/* Seleção da conta/cartão */}
            <div className="print:hidden">
            {tipoExtrato === 'conta' ? (
              <select className="input-field" value={contaExtratoId}
                onChange={(e) => setContaExtratoId(e.target.value)}>
                <option value="">Selecione uma conta...</option>
                {contasBancarias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.banco}</option>
                ))}
              </select>
            ) : (
              <select className="input-field" value={cartaoExtratoId}
                onChange={(e) => setCartaoExtratoId(e.target.value)}>
                <option value="">Selecione um cartão...</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — {c.bandeira}</option>
                ))}
              </select>
            )}
            </div>

            {/* Conteúdo do extrato */}
            {loadingListas ? (
              <div className="card h-32 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : erroListas ? (
              <div className="card p-8 text-center text-red-500">
                <p className="text-sm">Não foi possível carregar contas/cartões.</p>
              </div>
            ) : !hasContas && !hasCartoes ? (
              <div className="card p-8 text-center text-gray-500">
                <FileText size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Cadastre uma conta bancária ou cartão para ver o extrato.</p>
              </div>
            ) : (tipoExtrato === 'conta' && !hasContas) || (tipoExtrato === 'cartao' && !hasCartoes) ? (
              <div className="card p-8 text-center text-gray-500">
                <p className="text-sm">Nenhum {tipoExtrato === 'conta' ? 'conta bancária' : 'cartão'} disponível.</p>
              </div>
            ) : isLoadingLancamentos ? (
              <div className="card h-32 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : erroLancamentos ? (
              <div className="card p-8 text-center text-red-500">
                <p className="text-sm">Não foi possível carregar os lançamentos do extrato.</p>
              </div>
            ) : lancamentosExtrato.length === 0 && (contaExtratoId || cartaoExtratoId) ? (
              <div className="card p-8 text-center text-gray-400">
                <FileText size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum lançamento encontrado</p>
              </div>
            ) : lancamentosExtrato.length > 0 ? (
              <div className="card overflow-hidden">
                {/* Filtro mês + CSV */}
                <div className="flex items-center gap-3 p-4 border-b print:hidden">
                  <label className="text-sm font-medium text-gray-600 shrink-0">Mês:</label>
                  <select className="input-field flex-1 text-sm py-1.5" value={mesEfetivo}
                    onChange={(e) => setMesExtrato(e.target.value)}>
                    {mesesDisponiveisExtrato.map((m) => {
                      const [y, mo] = m.split('-')
                      return <option key={m} value={m}>{MESES_LABEL[parseInt(mo) - 1]}/{y}</option>
                    })}
                  </select>
                  <button onClick={copiarCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors shrink-0 print:hidden">
                    {copiadoExtrato ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copiadoExtrato ? 'Copiado!' : 'CSV'}
                  </button>
                  <button onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors shrink-0 print:hidden">
                    <Printer size={14} />
                    Imprimir
                  </button>
                </div>

                {/* Resumo */}
                <div className={`grid gap-2 px-4 py-3 border-b text-center ${
                  tipoExtrato === 'conta' ? 'grid-cols-3' : 'grid-cols-3'
                }`}>
                  {tipoExtrato === 'conta' ? (
                    <>
                      <div><p className="text-xs text-gray-400">Saldo anterior</p>
                        <p className={`text-sm font-bold ${saldoAntesDoMes >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                          {formatCurrency(saldoAntesDoMes)}</p></div>
                      <div><p className="text-xs text-green-600">+ Entradas</p>
                        <p className="text-sm font-bold text-green-600">{formatCurrency(totalEntC)}</p></div>
                      <div><p className="text-xs text-red-500">− Saídas</p>
                        <p className="text-sm font-bold text-red-500">{formatCurrency(totalSaiC)}</p></div>
                    </>
                  ) : (
                    <>
                      <div><p className="text-xs text-red-500">Compras</p>
                        <p className="text-sm font-bold text-red-600">{formatCurrency(totalCompras)}</p></div>
                      <div><p className="text-xs text-green-600">Pagamentos</p>
                        <p className="text-sm font-bold text-green-600">{formatCurrency(totalPagamentosCartao)}</p></div>
                      <div><p className="text-xs text-gray-500">Fatura</p>
                        <p className={`text-sm font-bold ${totalCompras - totalPagamentosCartao > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(Math.abs(totalCompras - totalPagamentosCartao))}</p></div>
                    </>
                  )}
                </div>

                {/* Lista */}
                <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto print-scroll-none">
                  {tipoExtrato === 'conta' && (
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 text-xs text-gray-500">
                      <span className="font-medium">Saldo anterior ao mês</span>
                      <span className={`font-bold ${saldoAntesDoMes >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                        {formatCurrency(saldoAntesDoMes)}
                      </span>
                    </div>
                  )}
                  {tipoExtrato === 'conta'
                    ? linhasConta.map(({ lancamento: l, saldo }) => (
                        <div key={l.id} className="flex items-center gap-2 px-4 py-2.5">
                          <div className={`w-1 h-8 rounded-full shrink-0 ${l.tipo === 'entrada' ? 'bg-green-400' : 'bg-red-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{l.descricao}</p>
                            <p className="text-xs text-gray-400">{l.data.split('-').reverse().join('/')}{l.categoria ? ` · ${l.categoria}` : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${l.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                              {l.tipo === 'entrada' ? '+' : '−'}{formatCurrency(l.valor)}
                            </p>
                            <p className={`text-xs ${saldo >= 0 ? 'text-gray-400' : 'text-red-400'}`}>{formatCurrency(saldo)}</p>
                          </div>
                        </div>
                      ))
                    : (lancamentosDoMes as CartaoLancamento[]).map((l) => (
                        <div key={l.id} className="flex items-center gap-2 px-4 py-2.5">
                          <div className={`w-1 h-8 rounded-full shrink-0 ${l.tipo === 'pagamento' ? 'bg-green-400' : 'bg-red-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{l.descricao}</p>
                            <p className="text-xs text-gray-400">{l.data.split('-').reverse().join('/')}{l.categoria ? ` · ${l.categoria}` : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${l.tipo === 'pagamento' ? 'text-green-600' : 'text-red-600'}`}>
                              {l.tipo === 'pagamento' ? '−' : '+'}{formatCurrency(l.valor)}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">{l.tipo}</p>
                          </div>
                        </div>
                      ))
                  }
                  {tipoExtrato === 'conta' && linhasConta.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 text-xs">
                      <span className="font-semibold text-gray-600">Saldo final do mês</span>
                      <span className={`font-bold text-sm ${
                        (linhasConta[linhasConta.length - 1]?.saldo ?? 0) >= 0 ? 'text-gray-800' : 'text-red-600'
                      }`}>
                        {formatCurrency(linhasConta[linhasConta.length - 1]?.saldo ?? saldoAntesDoMes)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center text-gray-400">
                <FileText size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecione uma {tipoExtrato === 'conta' ? 'conta bancária' : 'cartão de crédito'} acima</p>
              </div>
            )}
          </div>
        )
      })()}
      {/* ===== Tab: Contas a Pagar Por Dia ===== */}
      {tab === 'dia' && (
        <div className="space-y-4">
          {/* Controles */}
          <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Data:</label>
              <input
                type="date"
                value={dataDia}
                onChange={(e) => setDataDia(e.target.value)}
                className="input-field py-1.5 text-sm w-auto"
              />
            </div>
            <button
              onClick={() => window.print()}
              disabled={!contasDia || loadingDia}
              className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50 print:hidden"
            >
              <Printer size={15} />
              Imprimir
            </button>
          </div>

          {loadingDia ? (
            <div className="card h-32 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : contasDia ? (
            <>
              {/* Card total */}
              <div className="card p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Total a pagar em {dataDia.split('-').reverse().join('/')}</p>
                  <p className="text-xl font-bold text-danger-500">{formatCurrency(contasDia.total)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{contasDia.contas.length} conta(s)</p>
                </div>
              </div>

              {contasDia.contas.length === 0 ? (
                <div className="card p-8 text-center text-gray-400">
                  <FileText size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma conta a pagar nesta data.</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contasDia.contas.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-700 max-w-[160px] truncate">{c.descricao}</td>
                          <td className="px-4 py-3 text-gray-500">{CATEGORIAS_LABEL[c.categoria] ?? c.categoria}</td>
                          <td className="px-4 py-3 text-gray-500 capitalize">{c.tipo}</td>
                          <td className="px-4 py-3 text-right font-semibold text-danger-500">{formatCurrency(c.valor)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              STATUS_PAGAR[c.status]?.classes ?? 'bg-gray-100 text-gray-600'
                            }`}>
                              {STATUS_PAGAR[c.status]?.label ?? c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-danger-500">{formatCurrency(contasDia.total)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}    </div>
  )
}
