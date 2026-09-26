import { create } from 'zustand'

const STORAGE_KEY = 'equili-voice-preferences'

interface VoicePreferences {
  autoListenEnabled: boolean
  voiceConfirmationEnabled: boolean
}

interface VoiceStore extends VoicePreferences {
  setAutoListenEnabled: (enabled: boolean) => void
  setVoiceConfirmationEnabled: (enabled: boolean) => void
}

function loadPreferences(): VoicePreferences {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value) {
      const parsed = JSON.parse(value) as Partial<VoicePreferences>
      return {
        autoListenEnabled: typeof parsed.autoListenEnabled === 'boolean' ? parsed.autoListenEnabled : true,
        voiceConfirmationEnabled:
          typeof parsed.voiceConfirmationEnabled === 'boolean' ? parsed.voiceConfirmationEnabled : true,
      }
    }
  } catch {}

  return {
    autoListenEnabled: true,
    voiceConfirmationEnabled: true,
  }
}

function persistPreferences(preferences: VoicePreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {}
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  ...loadPreferences(),
  setAutoListenEnabled: (enabled) => {
    set({ autoListenEnabled: enabled })
    persistPreferences({
      autoListenEnabled: enabled,
      voiceConfirmationEnabled: get().voiceConfirmationEnabled,
    })
  },
  setVoiceConfirmationEnabled: (enabled) => {
    set({ voiceConfirmationEnabled: enabled })
    persistPreferences({
      autoListenEnabled: get().autoListenEnabled,
      voiceConfirmationEnabled: enabled,
    })
  },
}))
