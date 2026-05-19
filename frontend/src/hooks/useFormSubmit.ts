import { useState } from 'react'
import { parseApiError } from '@/utils/api'

/**
 * Encapsula o padrão recorrente de submit assíncrono com gestão de loading e erro.
 *
 * Uso básico (erro via parseApiError):
 *   const { submit, error, isPending } = useFormSubmit()
 *   await submit(() => api.post('/endpoint', data).then(() => onClose()))
 *
 * Com mensagem personalizada por status:
 *   await submit(fn, (err) => err.response?.status === 403 ? 'Limite.' : null)
 */
export function useFormSubmit() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function submit(
    fn: () => Promise<void>,
    getErrorMsg?: (err: unknown) => string | null
  ): Promise<void> {
    setError(null)
    setIsPending(true)
    try {
      await fn()
    } catch (err) {
      setError(
        getErrorMsg
          ? (getErrorMsg(err) ?? 'Erro inesperado. Tente novamente.')
          : (parseApiError(err) ?? 'Erro inesperado. Tente novamente.')
      )
    } finally {
      setIsPending(false)
    }
  }

  return { submit, error, isPending }
}
