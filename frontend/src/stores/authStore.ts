import { create } from 'zustand'
import { queryClient } from '@/lib/queryClient'

export interface AuthUser {
  id: string
  nome: string
  email: string
  plano: string
}

interface AuthStore {
  accessToken: string | null
  user: AuthUser | null
  setAccessToken: (token: string) => void
  setUser: (user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  logout: () => {
    queryClient.clear()
    set({ accessToken: null, user: null })
  },
}))
