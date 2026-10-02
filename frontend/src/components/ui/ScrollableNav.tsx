import { useMemo, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { useScrollIndicator } from '@/hooks/useScrollIndicator'

/**
 * Dispositivos de toque (app Capacitor, iOS/Android, PWA mobile) usam scrollbar overlay e ignoram
 * ::-webkit-scrollbar: nesses casos o indicador é desenhado pelo componente. Desktop mantém a barra CSS.
 */
function usaIndicadorCustomizado(): boolean {
  if (Capacitor.isNativePlatform()) return true
  return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches
}

interface Props {
  className?: string
  children: ReactNode
}

export function ScrollableNav({ className = '', children }: Props) {
  const custom = useMemo(usaIndicadorCustomizado, [])
  const { ref, thumb } = useScrollIndicator<HTMLElement>(custom)

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <nav
        ref={ref}
        className={`${className} ${custom ? 'scrollbar-none' : 'sidebar-nav'} flex-1 min-h-0 overflow-y-auto`}
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        {children}
      </nav>
      {custom && thumb.visible && (
        <div className="scroll-indicator-track" aria-hidden="true">
          <div
            className="scroll-indicator-thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
          />
        </div>
      )}
    </div>
  )
}
