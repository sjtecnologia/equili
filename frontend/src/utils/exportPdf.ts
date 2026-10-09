/**
 * Exportação de relatórios em PDF (client-side via jsPDF + jspdf-autotable).
 *
 * Padrão: cabeçalho com marca Equili + título, tabelas por seção com sub-títulos,
 * e rodapé com data de geração e numeração de páginas.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrency, formatDate } from '@/utils/format'
import { CATEGORIAS_LABEL, ORIGENS_LABEL, STATUS_PAGAR, STATUS_RECEBER } from '@/utils/labels'
import type { FluxoMes, RelatorioDetalhado } from '@/types/financeiro'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const VERDE: [number, number, number] = [46, 125, 94]
const CINZA: [number, number, number] = [100, 116, 139]

export interface SecaoPdf {
  /** Título exibido acima da tabela (opcional). */
  label?: string
  colunas: string[]
  /** Células já formatadas como texto. */
  linhas: string[][]
}

export interface PdfParams {
  titulo: string
  subtitulo?: string
  nomeArquivo: string
  filtrosTexto?: string
  secoes: SecaoPdf[]
  rodapeLinhas?: string[]
}

/** V5 não declara, mas o `autoTable` seta `doc.lastAutoTable.finalY` em runtime. */
function finalYDaTabela(doc: jsPDF): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
  return last?.finalY ?? 40
}

/**
 * Gera e baixa um PDF A4 com base nas seções informadas.
 * Todos os valores devem vir prontos para exibição.
 */
export function gerarPdf({ titulo, subtitulo, nomeArquivo, filtrosTexto, secoes, rodapeLinhas }: PdfParams): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const altura = doc.internal.pageSize.getHeight()

  // Faixa de cabeçalho
  doc.setFillColor(VERDE[0], VERDE[1], VERDE[2])
  doc.rect(0, 0, width, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('EQUILI', 14, 10)
  doc.setFontSize(11)
  doc.text(titulo, 14, 17)
  doc.setTextColor(51, 51, 51)
  doc.setFont('helvetica', 'normal')

  let y = 28
  const geradoEm = `Gerado em ${new Date().toLocaleString('pt-BR')}`

  if (subtitulo) {
    doc.setFontSize(9)
    doc.setTextColor(CINZA[0], CINZA[1], CINZA[2])
    doc.text(subtitulo, 14, y + 3)
    y += 6
  }
  if (filtrosTexto) {
    doc.setFontSize(8)
    doc.setTextColor(CINZA[0], CINZA[1], CINZA[2])
    const linhasFiltro = doc.splitTextToSize(`Filtros: ${filtrosTexto}`, width - 28)
    doc.text(linhasFiltro, 14, y + 3)
    y += Math.max(linhasFiltro.length, 1) * 4 + 4
  }
  if (rodapeLinhas?.length) {
    doc.setFontSize(9)
    doc.setTextColor(31, 41, 55)
    doc.text(rodapeLinhas, 14, y + 3)
    y += rodapeLinhas.length * 4.5 + 5
  }

  y += 2

  secoes.forEach((secao, i) => {
    if (secao.label) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(46, 125, 94)
      doc.text(secao.label, 14, y)
      doc.setFont('helvetica', 'normal')
      y += 4.5
    }
    autoTable(doc, {
      head: [secao.colunas],
      body: secao.linhas,
      startY: y,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 246] },
    })
    y = finalYDaTabela(doc) + (i < secoes.length - 1 ? 8 : 0)
  })

  // Rodapé com data e numeração de páginas
  const totalPaginas = doc.getNumberOfPages()
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(CINZA[0], CINZA[1], CINZA[2])
    doc.text(geradoEm, 14, altura - 7)
    doc.text(`Página ${p} de ${totalPaginas}`, width - 14, altura - 7, { align: 'right' })
  }

  doc.save(nomeArquivo)
}

// ─── Exportações específicas ─────────────────────────────────────────────────

export function exportarFluxoCaixaPdf(data: FluxoMes[], ano: number, filtrosTexto: string): void {
  const entradas = data.reduce((s, d) => s + d.entradas, 0)
  const saidas = data.reduce((s, d) => s + d.saidas, 0)
  const saldo = entradas - saidas
  gerarPdf({
    titulo: `Fluxo de Caixa — ${ano}`,
    nomeArquivo: `fluxo_caixa_${ano}.pdf`,
    filtrosTexto,
    secoes: [
      {
        colunas: ['Mês', 'Entradas', 'Saídas', 'Saldo'],
        linhas: data.map((d) => [d.mes_nome, formatCurrency(d.entradas), formatCurrency(d.saidas), formatCurrency(d.saldo)]),
      },
    ],
    rodapeLinhas: [
      `Total de entradas: ${formatCurrency(entradas)}`,
      `Total de saídas: ${formatCurrency(saidas)}`,
      `Saldo anual: ${formatCurrency(saldo)}`,
    ],
  })
}

export function exportarDetalhadoPdf(data: RelatorioDetalhado, mes: number, ano: number, filtrosTexto: string): void {
  const linhasReceber = data.contas_receber.map((c) => [
    c.descricao,
    ORIGENS_LABEL[c.origem] ?? c.origem,
    formatCurrency(c.valor),
    formatDate(c.data_prevista),
    STATUS_RECEBER[c.status]?.label ?? c.status,
    c.tipo,
    c.devedor ?? '',
    c.observacao ?? '',
  ])
  const linhasPagar = data.contas_pagar.map((c) => [
    c.descricao,
    CATEGORIAS_LABEL[c.categoria] ?? c.categoria,
    formatCurrency(c.valor),
    formatDate(c.data_vencimento),
    STATUS_PAGAR[c.status]?.label ?? c.status,
    c.tipo,
    c.observacao ?? '',
  ])

  gerarPdf({
    titulo: `Relatório Detalhado — ${MESES[mes - 1] ?? mes}/${ano}`,
    nomeArquivo: `relatorio_${ano}_${String(mes).padStart(2, '0')}.pdf`,
    filtrosTexto,
    secoes: [
      {
        label: 'Resumo do mês',
        colunas: ['Item', 'Valor'],
        linhas: [
          ['Total a receber', formatCurrency(data.totais.total_receber)],
          ['Total a pagar', formatCurrency(data.totais.total_pagar)],
          ['Saldo', formatCurrency(data.totais.saldo)],
        ],
      },
      { label: 'Contas a Receber', colunas: ['Descrição', 'Origem', 'Valor', 'Prevista', 'Status', 'Tipo', 'Devedor', 'Observação'], linhas: linhasReceber },
      { label: 'Contas a Pagar', colunas: ['Descrição', 'Categoria', 'Valor', 'Vencimento', 'Status', 'Tipo', 'Observação'], linhas: linhasPagar },
    ],
  })
}

// ─── Notas Fiscais (NFS) ─────────────────────────────────────────────────────

interface NfsNotaExport {
  numero: string
  serie?: string | null
  valor: number | string
  chave_acesso?: string
  codigo_verificacao?: string | null
  cpf_cnpj?: string | null
  data_emissao?: string | null
}

export function exportarNfsPdf(notas: NfsNotaExport[], filtrosTexto: string, subtitulo?: string): void {
  const linhas = notas.map((n) => [
    `NF ${n.numero} · Série ${n.serie || '001'}`,
    formatCurrency(Number(n.valor) || 0),
    n.chave_acesso ?? '',
    n.codigo_verificacao ?? '',
    n.cpf_cnpj ?? '',
    n.data_emissao ? formatDate(n.data_emissao) : '',
  ])
  const total = notas.reduce((s, n) => s + (Number(n.valor) || 0), 0)
  gerarPdf({
    titulo: 'Notas Fiscais (NFS-e)',
    subtitulo,
    nomeArquivo: `nfs_${new Date().toLocaleDateString('en-CA')}.pdf`,
    filtrosTexto,
    secoes: [
      {
        colunas: ['Nota', 'Valor', 'Chave de acesso', 'Código', 'CPF/CNPJ', 'Emitida em'],
        linhas,
      },
    ],
    rodapeLinhas: [`${notas.length} nota(s) · Total: ${formatCurrency(total)}`],
  })
}

export function exportarNfsExcel(notas: NfsNotaExport[], filtrosTexto: string): void {
  const rows = notas.map((n) => ({
    'Nota': `NF ${n.numero} · Série ${n.serie || '001'}`,
    'Valor (R$)': Number(n.valor) || 0,
    'Chave de acesso': n.chave_acesso ?? '',
    'Código verificação': n.codigo_verificacao ?? '',
    'CPF/CNPJ': n.cpf_cnpj ?? '',
    'Emitida em': n.data_emissao ?? '',
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Notas fiscais')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Filtros', filtrosTexto]]), 'Filtros')
  XLSX.writeFile(wb, `nfs_${new Date().toLocaleDateString('en-CA')}.xlsx`)
}