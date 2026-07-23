import { useEffect, useState } from 'react'
import { Download, PlusSquare, Share2, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface CapacitorWindow extends Window {
  Capacitor?: { isNativePlatform?: () => boolean }
}

interface IOSNavigator extends Navigator {
  standalone?: boolean
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  useEffect(() => {
    // Nunca mostrar dentro do app nativo Capacitor
    const isNativeApp = (window as CapacitorWindow).Capacitor?.isNativePlatform?.() === true
    if (isNativeApp) return

    // Detecta iOS (Safari não dispara beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as IOSNavigator).standalone
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
    setFeedback(null)

    if (isIOS) {
      setShowIOSSteps(true)
      if ('share' in navigator) {
        try {
          await navigator.share({
            title: 'Equili',
            text: 'Instalar Equili na tela inicial',
            url: window.location.href,
          })
        } catch {
          // O usuario pode cancelar o menu de compartilhamento; o passo a passo visual continua visivel.
        }
      }
      return
    }

    if (!deferredPrompt) {
      setFeedback('A instalacao nao esta disponivel agora. Recarregue a pagina e tente novamente.')
      return
    }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    setShowIOSSteps(false)
    setFeedback(null)
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
              Instale com icone: <strong>Compartilhar</strong> → <strong>Adicionar a Tela de Inicio</strong>
            </p>
          ) : (
            <p className="text-indigo-300 text-xs mt-0.5">
              Adicione à tela inicial para acesso rápido, mesmo sem internet.
            </p>
          )}
          <button
            onClick={handleInstall}
            className="mt-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {isIOS ? 'Ver passo a passo' : 'Instalar agora'}
          </button>
          {isIOS && showIOSSteps && (
            <div className="mt-2 rounded-lg border border-indigo-700 bg-indigo-950/50 p-2">
              <div className="flex items-center gap-2">
                <img src="/apple-touch-icon-v2.png" alt="Icone do Equili" className="h-8 w-8 rounded-md" />
                <p className="text-indigo-100 text-xs">O iPhone vai criar o app com este icone na tela inicial.</p>
              </div>
              <div className="mt-2 space-y-1 text-indigo-200 text-xs">
                <p className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> 1. Toque em Compartilhar no Safari.</p>
                <p className="flex items-center gap-1"><PlusSquare className="h-3.5 w-3.5" /> 2. Selecione Adicionar a Tela de Inicio.</p>
                <p>3. Confirme em Adicionar.</p>
              </div>
            </div>
          )}
          {feedback && <p className="text-indigo-200 text-xs mt-2">{feedback}</p>}
        </div>
        <button onClick={handleDismiss} className="text-indigo-400 hover:text-white transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
