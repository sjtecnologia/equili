import { create } from 'zustand'
import axios from 'axios'
import { queryClient } from '@/lib/queryClient'
import { clearBiometricCredentials } from '@/services/biometrics'
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

interface AuthStore {
  status: AuthStatus
  accessToken: string | null
  user: AuthUser | null
  setAccessToken: (token: string) => void
  setUser: (user: AuthUser) => void
  authenticateWithToken: (token: string) => Promise<void>
  bootstrapSession: () => Promise<boolean>
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
  bootstrapSession: async () => {
    set({ status: 'loading' })
    try {
      const csrf = getCookie('csrf_token')
      const refresh = await axios.post<{ access_token: string }>(
        `${API_BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
        }
      )
      const token = refresh.data.access_token
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
    } catch (err) {
      console.error('[biometria] falha ao remover credenciais no logout', err)
    }
  },
}))
