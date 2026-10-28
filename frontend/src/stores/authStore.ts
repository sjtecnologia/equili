import { create } from 'zustand'
import axios from 'axios'
import { queryClient } from '@/lib/queryClient'
import { clearBiometricCredentials, confirmarRestauracaoSessao } from '@/services/biometrics'
import { clearRefreshToken, getRefreshToken, saveRefreshToken } from '@/services/secureSession'
import { API_BASE_URL } from '@/services/apiConfig'

function getCookie(name: string): string | null {
  const prefix = `${name}=`
  const found = document.cookie.split('; ').find((c) => c.startsWith(prefix))
  return found ? decodeURIComponent(found.slice(prefix.length)) : null
}

export interface AuthUser {
  id: string
  nome: string
  email: string
  plano: string
  is_admin: boolean
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface BootstrapOptions {
  /**
   * Não pede biometria antes de trocar o refresh token guardado. Use quando o
   * chamador já autenticou (ex.: botão "Entrar com Face ID" da tela de login).
   */
  autenticarBiometria?: boolean
}

interface AuthStore {
  status: AuthStatus
  accessToken: string | null
  user: AuthUser | null
  setAccessToken: (token: string) => void
  setUser: (user: AuthUser) => void
  authenticateWithToken: (token: string) => Promise<void>
  bootstrapSession: (options?: BootstrapOptions) => Promise<boolean>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'loading',
  accessToken: null,
  user: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user, status: 'authenticated' }),
  authenticateWithToken: async (token) => {
    const me = await axios.get<AuthUser>(`${API_BASE_URL}/usuarios/me`, {
      withCredentials: true,
      headers: { Authorization: `Bearer ${token}` },
    })
    set({ accessToken: token, user: me.data, status: 'authenticated' })
  },
  bootstrapSession: async (options) => {
    set({ status: 'loading' })
    try {
      const salvo = await getRefreshToken()
      let token: string

      if (salvo) {
        // App nativo: a sessão vem do refresh token guardado no Keychain/
        // Keystore — o cookie httpOnly não chega ao backend a partir do
        // WebView (origem capacitor://localhost). Antes de trocá-lo por um
        // access token, exige Face ID / código do dispositivo, para a sessão
        // restaurada nunca ficar protegida apenas por estar no aparelho.
        if (options?.autenticarBiometria !== false) {
          const ok = await confirmarRestauracaoSessao()
          if (!ok) {
            set({ accessToken: null, user: null, status: 'unauthenticated' })
            return false
          }
        }
        const refresh = await axios.post<{ access_token: string; refresh_token?: string | null }>(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: salvo },
          { withCredentials: true }
        )
        token = refresh.data.access_token
        if (refresh.data.refresh_token) {
          await saveRefreshToken(refresh.data.refresh_token)
        }
      } else {
        const csrf = getCookie('csrf_token')
        const refresh = await axios.post<{ access_token: string }>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
          }
        )
        token = refresh.data.access_token
      }

      const me = await axios.get<AuthUser>(`${API_BASE_URL}/usuarios/me`, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` },
      })
      set({ accessToken: token, user: me.data, status: 'authenticated' })
      return true
    } catch {
      set({ accessToken: null, user: null, status: 'unauthenticated' })
      return false
    }
  },
  logout: async () => {
    queryClient.clear()
    set({ accessToken: null, user: null, status: 'unauthenticated' })
    try {
      await clearBiometricCredentials()
      await clearRefreshToken()
    } catch (err) {
      console.error('[biometria] falha ao remover credenciais no logout', err)
    }
  },
}))
