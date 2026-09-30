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
        <nav className="flex flex-col w-full max-w-full box-border p-0 m-0 list-none flex-1 overflow-y-auto">
          {ALL_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={requiresExactActiveMatch(to)}
              onClick={onClose}
              className={({ isActive }) =>
                `flex flex-row items-center justify-start gap-2 w-full min-h-12 px-4 py-3 box-border leading-normal text-left m-0 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-100 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={24} className="inline-flex items-center justify-center w-6 h-6 align-middle shrink-0 m-0 box-border" />
              <span className="inline text-sm leading-[1.2] align-middle whitespace-nowrap overflow-hidden text-ellipsis flex-[1_1_auto] m-0 p-0 box-border">{label}</span>
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
