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
  // Garante visível por no mínimo 4.5s para as animações serem vistas
  const MIN_DISPLAY_MS = 4500
  const mountedAt = useRef(Date.now())

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

  // Quando o app está pronto, espera o tempo mínimo antes de fechar
  useEffect(() => {
    if (!ready) return
    const elapsed = Date.now() - mountedAt.current
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)
    const t = setTimeout(() => {
      setHiding(true)
      setTimeout(() => setUnmounted(true), 700)
    }, remaining)
    return () => clearTimeout(t)
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

