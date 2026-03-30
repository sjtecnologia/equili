import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, CreditCard, Sparkles, Settings, ArrowDownCircle, ArrowUpCircle, BarChart2 } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/renda', icon: Wallet, label: 'Renda' },
  { to: '/dividas', icon: CreditCard, label: 'Dívidas' },
  { to: '/contas-pagar', icon: ArrowUpCircle, label: 'Contas a Pagar' },
  { to: '/contas-receber', icon: ArrowDownCircle, label: 'Contas a Receber' },
  { to: '/relatorios', icon: BarChart2, label: 'Relatórios' },
  { to: '/plano-de-acao', icon: Sparkles, label: 'Plano de Ação' },
]

export default function Sidebar() {
  return (
    <div className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <span className="text-2xl font-bold text-primary-500">Equili</span>
        <p className="text-xs text-gray-500 mt-0.5">Controle financeiro familiar</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-primary-100 text-primary-500'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <NavLink
          to="/configuracoes"
          className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium text-gray-500 hover:bg-gray-100"
        >
          <Settings size={20} />
          Configurações
        </NavLink>
        <div className="mt-3 mx-3 p-3 bg-primary-100 rounded text-xs">
          <p className="font-semibold text-primary-500">Plano Gratuito</p>
          <p className="text-gray-500 mt-0.5">Upgrade para recursos completos</p>
        </div>
      </div>
    </div>
  )
}
