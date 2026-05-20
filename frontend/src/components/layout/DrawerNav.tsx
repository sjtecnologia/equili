import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { ALL_NAV_ITEMS, requiresExactActiveMatch } from '@/config/navItems'
import logo from '@/assets/logo.png'

interface Props {
  open: boolean
  onClose: () => void
}

export default function DrawerNav({ open, onClose }: Props) {
  // Fecha ao pressionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Overlay — só renderiza quando aberto para não capturar eventos */}
      <div
        className="drawer-overlay"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose}
      />

      {/* Painel lateral */}
      <div
        className="drawer-panel"
        style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        {/* Header do drawer */}
        <div
          className="flex items-center justify-between px-4 border-b border-gray-100"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: '12px' }}
        >
          <img src={logo} alt="Equili" className="h-10 w-auto" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Itens de navegação */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {ALL_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={requiresExactActiveMatch(to)}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl mb-0.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-100 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé */}
        <div
          className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 text-center"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          Equili — Equilíbrio financeiro inteligente
        </div>
      </div>
    </>
  )
}
