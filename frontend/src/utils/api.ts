/**
 * Extrai uma mensagem legível de um erro de API (axios/fetch).
 * Centraliza o padrão repetido em 50+ try/catch de toda a aplicação.
 */
export function parseApiError(err: unknown): string {
  const e = err as {
    response?: { status?: number; data?: { detail?: string | { msg: string }[] } }
  }
  const status = e.response?.status
  const detail = e.response?.data?.detail

  if (status === 401 || status === 403) {
    if (typeof detail === 'string') return detail
    return 'Acesso negado.'
  }
  if (status === 409) {
    if (typeof detail === 'string') return detail
    return 'Este item já existe.'
  }
  if (status === 422) {
    if (Array.isArray(detail)) return detail[0]?.msg ?? 'Dados inválidos.'
    if (typeof detail === 'string') return detail
    return 'Dados inválidos.'
  }
  if (typeof detail === 'string') return detail
  if (!status) return 'Servidor indisponível. Tente novamente em instantes.'
  return 'Erro ao processar. Tente novamente.'
}
