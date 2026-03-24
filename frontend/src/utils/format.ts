export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

export function formatMonthYear(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

export function parseCurrencyInput(value: string): number {
  const clean = value.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}
