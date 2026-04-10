import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, CreditCard, Sparkles, ArrowUpCircle, ArrowDownCircle, MessageSquare, Settings, TrendingUp, Receipt } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { to: '/renda', icon: Wallet, label: 'Renda' },
  { to: '/dividas', icon: CreditCard, label: 'Dívidas' },
  { to: '/dividas/baixas', icon: Receipt, label: 'Baixas' },
  { to: '/contas-pagar', icon: ArrowUpCircle, label: 'A Pagar' },
  { to: '/contas-receber', icon: ArrowDownCircle, label: 'A Receber' },
  { to: '/investimentos', icon: TrendingUp, label: 'Invest.' },
  { to: '/chat', icon: MessageSquare, label: 'IA' },
  { to: '/plano-de-acao', icon: Sparkles, label: 'Plano IA' },
  { to: '/configuracoes', icon: Settings, label: 'Config.' },
]

export default function BottomNav() {
  return (
    <nav className="bg-white border-t border-gray-200 safe-pb">
      <div className="flex overflow-x-auto scrollbar-none px-1 py-1.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded text-xs font-medium transition-colors duration-150 shrink-0 ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            <Icon size={20} />
            <span className="whitespace-nowrap">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

