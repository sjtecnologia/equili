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

  if (status === 401) {
    if (typeof detail === 'string') return detail
    return 'Email ou senha incorretos.'
  }
  if (status === 403) {
    if (typeof detail === 'string') return detail
    return 'Acesso negado.'
  }
  if (status === 409) {
    if (typeof detail === 'string') return detail
    return 'Este item já existe.'
  }
  if (status === 422) {
    return 'Verifique os dados informados.'
  }
  if (typeof status === 'number' && status >= 500) {
    return 'Servidor indisponível. Tente novamente em instantes.'
  }
  if (typeof detail === 'string') return detail
  if (!status) return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'
  return 'Erro ao processar. Tente novamente.'
}
