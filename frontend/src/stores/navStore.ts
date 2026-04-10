import { create } from 'zustand'
import { DEFAULT_SHORTCUTS } from '@/config/navItems'

const STORAGE_KEY = 'equili-nav-shortcuts'

function load(): string[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v) return JSON.parse(v)
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
