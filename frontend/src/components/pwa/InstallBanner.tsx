import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Detecta iOS (Safari não dispara beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as any).standalone
    setIsIOS(ios)
    if (ios) {
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) setVisible(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) {
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        setVisible(true)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-80">
      <div className="bg-indigo-900 border border-indigo-600 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="bg-indigo-600 rounded-xl p-2 flex-shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Instale o Equili</p>
          {isIOS ? (
            <p className="text-indigo-300 text-xs mt-0.5">
              Toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>
            </p>
          ) : (
            <p className="text-indigo-300 text-xs mt-0.5">
              Adicione à tela inicial para acesso rápido, mesmo sem internet.
            </p>
          )}
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="mt-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Instalar agora
            </button>
          )}
        </div>
        <button onClick={handleDismiss} className="text-indigo-400 hover:text-white transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
