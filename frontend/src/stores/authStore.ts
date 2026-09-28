import { create } from 'zustand'
import axios from 'axios'
import { queryClient } from '@/lib/queryClient'

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
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'loading',
  accessToken: null,
  user: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user, status: 'authenticated' }),
  authenticateWithToken: async (token) => {
    const me = await axios.get<AuthUser>('/api/v1/usuarios/me', {
      withCredentials: true,
      headers: { Authorization: `Bearer ${token}` },
    })
    set({ accessToken: token, user: me.data, status: 'authenticated' })
  },
  bootstrapSession: async () => {
    set({ status: 'loading' })
    try {
      const refresh = await axios.post<{ access_token: string }>(
        '/api/v1/auth/refresh',
        {},
        { withCredentials: true }
      )
      const token = refresh.data.access_token
      const me = await axios.get<AuthUser>('/api/v1/usuarios/me', {
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
  logout: () => {
    queryClient.clear()
    set({ accessToken: null, user: null, status: 'unauthenticated' })
  },
}))
