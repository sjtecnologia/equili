import { useEffect, useState } from 'react'
import { SplashScreen } from '@capacitor/splash-screen'
import logo from '@/assets/logo.png'

interface Props {
  ready: boolean
}

export default function AnimatedSplash({ ready }: Props) {
  const [hiding, setHiding] = useState(false)
  const [unmounted, setUnmounted] = useState(false)

  // Esconde o splash nativo imediatamente — React cuida da animação
  useEffect(() => {
    SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {})
  }, [])

  // Quando o app está pronto, dispara fade-out e desmonta
  useEffect(() => {
    if (ready) {
      setHiding(true)
      const t = setTimeout(() => setUnmounted(true), 650)
      return () => clearTimeout(t)
    }
  }, [ready])

  if (unmounted) return null

  return (
    <div
      className="splash-overlay"
      style={{ opacity: hiding ? 0 : 1 }}
    >
      {/* Anel pulsante de fundo */}
      <div className="splash-ring splash-ring-1" />
      <div className="splash-ring splash-ring-2" />

      {/* Logo com bounce-in */}
      <div className="splash-logo-wrap">
        <img src={logo} alt="Equili" className="splash-logo" />
      </div>

      {/* Subtítulo */}
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
