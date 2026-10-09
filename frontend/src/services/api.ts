import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import type { PlanoCatalogo, PlanoEntitlements, UsuarioAdmin } from '@/types/financeiro'

const isNative = !!(window as unknown as { Capacitor?: { isNativePlatform?: boolean } }).Capacitor?.isNativePlatform

function getCookie(name: string): string | null {
  const prefix = `${name}=`
  const found = document.cookie.split('; ').find((c) => c.startsWith(prefix))
  return found ? decodeURIComponent(found.slice(prefix.length)) : null
}

const api = axios.create({
  baseURL: isNative ? 'https://equili.com.br/api/v1' : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // necessário para enviar o httpOnly cookie do refresh
})

export async function listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const { data } = await api.get('/usuarios/admin/usuarios')
  return data
}

export async function atualizarPlanoAdmin(usuarioId: string, plano: string): Promise<{ id: string; plano: string }> {
  const { data } = await api.patch(`/usuarios/admin/usuarios/${usuarioId}/plano`, { plano })
  return data
}

export async function toggleUsuarioAtivo(usuarioId: string, ativo: boolean): Promise<UsuarioAdmin> {
  const { data } = await api.patch(`/usuarios/admin/usuarios/${usuarioId}/ativo`, { ativo })
  return data
}

export async function excluirUsuario(usuarioId: string): Promise<void> {
  await api.delete(`/usuarios/admin/usuarios/${usuarioId}`)
}

export async function listarPlanos(): Promise<PlanoEntitlements[]> {
  const { data } = await api.get<PlanoCatalogo>('/planos')
  return data.planos
}

export async function meuPlano(): Promise<PlanoEntitlements> {
  const { data } = await api.get<PlanoEntitlements>('/planos/me')
  return data
}

// Interceptor: adiciona o access token em cada requisição
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const csrf = getCookie('csrf_token')
    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf
    }
  }
  return config
})

// Interceptor: tenta renovar token ao receber 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthEndpoint = original?.url?.includes('/auth/')
    const status = error.response?.status
    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      if (status === 403 || original._retry) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      original._retry = true
      try {
        const csrf = getCookie('csrf_token')
        const { data } = await axios.post(
          '/api/v1/auth/refresh',
          {},
          {
            withCredentials: true,
            headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
          }
        )
        useAuthStore.getState().setAccessToken(data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
