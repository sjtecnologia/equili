import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Printer, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '@/services/api'
import { useContas } from '@/hooks/useContas'
import { FiltrosBarra, CAMPOS_PERIODO, type CampoFiltro } from '@/components/shared/FiltrosBarra'
import { formatCurrency, formatDate } from '@/utils/format'

interface LinhaParcela {
  id: string
  natureza: 'pagar' | 'receber'
  descricao: string
  categoria: string
  tipo: string
  parcela: string
  vencimento: string
  status: string
  valor: number
  valor_baixado: number
  saldo_restante: number
  devedor: string | null
  observacao: string | null
}
const TIPOS = [{ value: 'avulsa', label: 'Avulsa' }, { value: 'recorrente', label: 'Recorrente' }, { value: 'parcelada', label: 'Parcelada' }]
const SITUACOES = [{ value: 'pendente', label: 'Em aberto' }, { value: 'parcial', label: 'Baixa parcial' }, { value: 'liquidado', label: 'Liquidado' }, { value: 'vencido', label: 'Vencido' }]
const NATUREZAS = [{ value: 'pagar', label: 'A pagar' }, { value: 'receber', label: 'A receber' }]

export function ParcelasRelatorio() {
  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const { contas, cartoes } = useContas()
  const { data: categorias = [] } = useQuery<{ nome: string }[]>({
    queryKey: ['categorias-relatorio'], queryFn: () => api.get('/categorias').then(r => r.data),
  })
  const { data: linhas = [], isFetching, isError } = useQuery<LinhaParcela[]>({
    queryKey: ['relatorio-detalhado', 'parcelas', filtros],
    queryFn: () => api.get('/relatorio/parcelas', { params: filtros }).then(r => r.data),
  })
  const campos: CampoFiltro[] = [
    { key: 'q', tipo: 'busca', placeholder: 'Descrição ou devedor' },
    { key: 'natureza', tipo: 'select', label: 'Contas', opcoes: NATUREZAS },
    { key: 'tipo', tipo: 'select', label: 'Tipo de lançamento', opcoes: TIPOS },
    { key: 'status', tipo: 'select', label: 'Situação', opcoes: SITUACOES },
    { key: 'categoria', tipo: 'select', label: 'Categoria / origem', opcoes: [...new Set(categorias.map(c => c.nome))].sort().map(nome => ({ value: nome, label: nome })) },
    { key: 'parcela', tipo: 'numero', label: 'Número da parcela' },
    { key: 'conta_id', tipo: 'select', label: 'Conta da baixa', opcoes: contas.map(c => ({ value: c.id, label: c.nome })) },
    { key: 'cartao_id', tipo: 'select', label: 'Cartão da baixa', span2: true, opcoes: cartoes.map(c => ({ value: c.id, label: c.nome })) },
    ...CAMPOS_PERIODO,
  ]
  const descricaoFiltros = campos.filter(c => filtros[c.key]).map(c => {
    const valor = filtros[c.key]
    const texto = c.tipo === 'select' ? c.opcoes.find(o => o.value === valor)?.label ?? valor : c.tipo === 'data' ? formatDate(valor) : valor
    return `${c.tipo === 'busca' ? 'Busca' : c.label}: ${texto}`
  }).join(' · ') || 'Todos os lançamentos'
  const total = (campo: 'valor' | 'valor_baixado' | 'saldo_restante', natureza?: string) => linhas.filter(l => !natureza || l.natureza === natureza).reduce((s, l) => s + l[campo], 0)

  function exportar() {
    const rows = linhas.map(l => ({
      'Conta': l.natureza === 'pagar' ? 'A pagar' : 'A receber', 'Descrição': l.descricao,
      'Parcela': l.parcela, 'Tipo': TIPOS.find(t => t.value === l.tipo)?.label ?? l.tipo,
      'Categoria / origem': l.categoria, 'Vencimento': l.vencimento,
      'Situação': SITUACOES.find(s => s.value === l.status)?.label ?? l.status,
      'Valor (R$)': l.valor, 'Baixado (R$)': l.valor_baixado, 'Restante (R$)': l.saldo_restante,
      'Devedor': l.devedor ?? '', 'Observação': l.observacao ?? '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Parcelas')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(NATUREZAS.map(n => ({
      'Contas': n.label, 'Valor (R$)': total('valor', n.value), 'Baixado (R$)': total('valor_baixado', n.value), 'Restante (R$)': total('saldo_restante', n.value),
    }))), 'Resumo')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Filtros', descricaoFiltros], ['Emitido em', new Date().toLocaleString('pt-BR')]]), 'Filtros')
    XLSX.writeFile(wb, `parcelas_${new Date().toLocaleDateString('en-CA')}.xlsx`)
  }

  return <section className="space-y-4">
    <div className="print:hidden"><FiltrosBarra campos={campos} onFiltrar={setFiltros} /></div>
    <p className="text-xs text-gray-500 break-words">{descricaoFiltros}</p>
    <div className="flex flex-wrap gap-2 print:hidden">
      <button onClick={exportar} disabled={isFetching || isError || !linhas.length} className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar Excel</button>
      <button onClick={() => window.print()} disabled={isFetching || isError || !linhas.length} className="btn-secondary flex items-center gap-2"><Printer size={16} />Imprimir</button>
    </div>
    {isFetching ? <Loader2 className="animate-spin" aria-label="Carregando relatório" /> : isError ? <p role="alert" className="text-red-600">Não foi possível carregar o relatório. Confira os filtros e o período.</p> : <>
      <div className="grid grid-cols-2 gap-4 border-y py-3 text-sm">
        <p>A pagar: <strong>{formatCurrency(total('saldo_restante', 'pagar'))}</strong></p>
        <p>A receber: <strong>{formatCurrency(total('saldo_restante', 'receber'))}</strong></p>
      </div>
      <p className="text-xs text-gray-500">{linhas.length} lançamento(s)</p>
      {!linhas.length ? <p className="text-sm text-gray-500 py-4">Nenhuma parcela encontrada.</p> : <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-xs border-collapse">
          <thead><tr className="border-b text-left">
            {['Conta / descrição', 'Parcela / tipo', 'Categoria', 'Vencimento', 'Situação', 'Valor', 'Baixado', 'Restante'].map(t => <th key={t} className="p-2">{t}</th>)}
          </tr></thead>
          <tbody>{linhas.map(l => <tr key={l.id} className="border-b align-top print:break-inside-avoid">
            <td className="p-2 min-w-36 print:min-w-0 break-words">{l.natureza === 'pagar' ? 'A pagar' : 'A receber'}<p className="font-medium">{l.descricao}</p>{l.devedor && <p>{l.devedor}</p>}</td>
            <td className="p-2">{l.parcela || '-'}<p>{TIPOS.find(t => t.value === l.tipo)?.label ?? l.tipo}</p></td>
            <td className="p-2 break-words">{l.categoria}</td><td className="p-2 whitespace-nowrap">{formatDate(l.vencimento)}</td>
            <td className="p-2">{SITUACOES.find(s => s.value === l.status)?.label ?? l.status}</td>
            <td className="p-2 text-right whitespace-nowrap">{formatCurrency(l.valor)}</td>
            <td className="p-2 text-right whitespace-nowrap">{formatCurrency(l.valor_baixado)}</td>
            <td className="p-2 text-right whitespace-nowrap">{formatCurrency(l.saldo_restante)}</td>
          </tr>)}</tbody>
          <tfoot><tr className="border-t font-semibold"><td colSpan={5} className="p-2">Total</td>
            <td className="p-2 whitespace-nowrap text-right">{formatCurrency(total('valor'))}</td>
            <td className="p-2 whitespace-nowrap text-right">{formatCurrency(total('valor_baixado'))}</td>
            <td className="p-2 whitespace-nowrap text-right">{formatCurrency(total('saldo_restante'))}</td>
          </tr></tfoot>
        </table>
      </div>}
    </>}
  </section>
}
