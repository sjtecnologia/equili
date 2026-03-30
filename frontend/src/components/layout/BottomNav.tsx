import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, Sparkles, ArrowDownCircle, ArrowUpCircle, BarChart2 } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { to: '/contas-pagar', icon: ArrowUpCircle, label: 'A Pagar' },
  { to: '/contas-receber', icon: ArrowDownCircle, label: 'A Receber' },
  { to: '/relatorios', icon: BarChart2, label: 'Relatórios' },
  { to: '/plano-de-acao', icon: Sparkles, label: 'Plano IA' },
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
