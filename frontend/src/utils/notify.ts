import toast from 'react-hot-toast'

type ApiError = { response?: { data?: { detail?: string } } }

function extractDetail(err: unknown, fallback: string): string {
  return (err as ApiError)?.response?.data?.detail ?? fallback
}

export const notify = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
  apiError: (err: unknown, fallback = 'Erro ao processar a solicitação') =>
    toast.error(extractDetail(err, fallback)),
}
