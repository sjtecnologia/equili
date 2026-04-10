import { useEffect, useRef, useState } from 'react'
import { SplashScreen } from '@capacitor/splash-screen'
import logo from '@/assets/logo.png'

interface Props {
  ready: boolean
}

export default function AnimatedSplash({ ready }: Props) {
  const [hiding, setHiding] = useState(false)
  const [unmounted, setUnmounted] = useState(false)
  const hiddenRef = useRef(false)

  // Esconde o splash nativo o mais rápido possível — iOS pode demorar, então tentamos várias vezes
  useEffect(() => {
    const hide = () => {
      if (hiddenRef.current) return
      SplashScreen.hide({ fadeOutDuration: 0 })
        .then(() => { hiddenRef.current = true })
        .catch(() => {})
    }
    hide()
    // Tenta novamente caso o plugin não estivesse pronto no primeiro call
    const t1 = setTimeout(hide, 100)
    const t2 = setTimeout(hide, 400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Quando o app está pronto, dispara fade-out e desmonta
  useEffect(() => {
    if (ready) {
      setHiding(true)
      const t = setTimeout(() => setUnmounted(true), 700)
      return () => clearTimeout(t)
    }
  }, [ready])

  if (unmounted) return null

  return (
    <div
      className="splash-overlay"
      style={{ opacity: hiding ? 0 : 1 }}
    >
      {/* Anéis pulsantes verdes (sutis no fundo branco) */}
      <div className="splash-ring splash-ring-1" />
      <div className="splash-ring splash-ring-2" />

      {/* Logo com fundo transparente, diretamente sobre o branco */}
      <div className="splash-logo-wrap">
        <img src={logo} alt="Equili" className="splash-logo" />
      </div>

      {/* Tagline */}
      <p className="splash-tagline">Equilíbrio financeiro inteligente</p>

      {/* Dots de carregamento */}
      <div className="splash-dots">
        <span className="splash-dot dot-1" />
        <span className="splash-dot dot-2" />
        <span className="splash-dot dot-3" />
      </div>
    </div>
  )
}

