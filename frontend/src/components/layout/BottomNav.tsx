import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, CreditCard, Sparkles, Bell } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { to: '/renda', icon: Wallet, label: 'Renda' },
  { to: '/dividas', icon: CreditCard, label: 'Dívidas' },
  { to: '/plano-de-acao', icon: Sparkles, label: 'Plano IA' },
  { to: '/alertas', icon: Bell, label: 'Alertas' },
]

export default function BottomNav() {
  return (
    <nav className="bg-white border-t border-gray-200 flex justify-around px-2 py-2 safe-pb">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1 rounded text-xs font-medium transition-colors duration-150 min-w-0 ${
              isActive ? 'text-primary-500' : 'text-gray-400'
            }`
          }
        >
          <Icon size={22} />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
