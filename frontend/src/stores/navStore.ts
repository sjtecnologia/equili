import { create } from 'zustand'
import { DEFAULT_SHORTCUTS } from '@/config/navItems'

const STORAGE_KEY = 'equili-nav-shortcuts'

function load(): string[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v) {
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed)) {
        const shortcuts = parsed.filter((item): item is string => typeof item === 'string')

        // Migração de atalhos antigos: garante que Relatórios possa aparecer por padrão.
        if (!shortcuts.includes('/relatorios')) {
          if (shortcuts.includes('/configuracoes')) {
            return shortcuts.map((s) => (s === '/configuracoes' ? '/relatorios' : s))
          }
          if (shortcuts.length < 5) {
            return [...shortcuts, '/relatorios']
          }
        }

        return shortcuts
      }
    }
  } catch {}
  return DEFAULT_SHORTCUTS
}

interface NavStore {
  shortcuts: string[]
  setShortcuts: (shortcuts: string[]) => void
}

export const useNavStore = create<NavStore>((set) => ({
  shortcuts: load(),
  setShortcuts: (shortcuts) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts)) } catch {}
    set({ shortcuts })
  },
}))
