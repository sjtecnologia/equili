import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Wallet, CreditCard, Sparkles, Settings, LogOut, ArrowDownCircle, ArrowUpCircle, BarChart2, Receipt, MessageSquare, TrendingUp, Landmark, FileText } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'
import logo from '@/assets/logo.png'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/renda', icon: Wallet, label: 'Renda' },
  { to: '/dividas', icon: CreditCard, label: 'Dívidas' },
  { to: '/dividas/baixas', icon: Receipt, label: 'Baixas de Dívidas' },
  { to: '/contas-pagar', icon: ArrowUpCircle, label: 'Contas a Pagar' },
  { to: '/contas-receber', icon: ArrowDownCircle, label: 'Contas a Receber' },
  { to: '/plano-de-acao', icon: Sparkles, label: 'Plano de Ação' },
  { to: '/chat', icon: MessageSquare, label: 'Assistente IA' },
  { to: '/investimentos', icon: TrendingUp, label: 'Investimentos' },
  { to: '/contas-bancarias', icon: Landmark, label: 'Contas e Cartões' },
  { to: '/relatorios', icon: BarChart2, label: 'Relatórios' },
  { to: '/relatorios?tab=extrato', icon: FileText, label: 'Extrato' },
]

function avatarLetters(nome: string) {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export default function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  async function handleLogout() {
    await api.post('/auth/logout').catch(() => {})
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <img src={logo} alt="Equili" className="h-14 w-auto" />
      </div>

      {/* Usuário logado */}
      {user && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {avatarLetters(user.nome)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{user.nome}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      )}

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
      <div className="p-4 border-t border-gray-100 space-y-1">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors duration-150 ${
              isActive ? 'bg-primary-100 text-primary-500' : 'text-gray-500 hover:bg-gray-100'
            }`
          }
        >
          <Settings size={20} />
          Configurações
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors duration-150"
        >
          <LogOut size={20} />
          Sair
        </button>
        {user && (
          <div className="mt-2 mx-1 p-3 bg-primary-100 rounded text-xs">
            <p className="font-semibold text-primary-500 capitalize">Plano {user.plano}</p>
            {user.plano === 'gratuito' && (
              <p className="text-gray-500 mt-0.5">Upgrade para recursos completos</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
