import { NavLink, useNavigate } from 'react-router-dom'
import { Settings, LogOut, ShieldCheck } from 'lucide-react'
import { ALL_NAV_ITEMS, requiresExactActiveMatch } from '@/config/navItems'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'
import { ScrollableNav } from '@/components/ui/ScrollableNav'
import logo from '@/assets/logo.png'

const mainNavItems = ALL_NAV_ITEMS.filter((item) => item.to !== '/configuracoes')

function avatarLetters(nome: string) {
  return (nome ?? '')
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
    <div className="w-60 h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100 shrink-0">
        <img src={logo} alt="Equili" className="h-14 w-auto" />
      </div>

      {/* Usuário logado */}
      {user && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
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
      <ScrollableNav className="flex flex-col w-full max-w-full box-border p-0 m-0 list-none">
        {mainNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={requiresExactActiveMatch(to)}
            className={({ isActive }) =>
              `flex flex-row items-center justify-start gap-2 w-full min-h-12 px-4 py-3 box-border leading-normal text-left m-0 rounded text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-primary-100 text-primary-500'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon size={24} className="inline-flex items-center justify-center w-6 h-6 align-middle shrink-0 m-0 box-border" />
            <span className="inline text-sm leading-[1.2] align-middle whitespace-nowrap overflow-hidden text-ellipsis flex-[1_1_auto] m-0 p-0 box-border">{label}</span>
          </NavLink>
        ))}
        {user?.is_admin === true && (
          <NavLink
            to="/admin/usuarios"
            className={({ isActive }) =>
              `flex flex-row items-center justify-start gap-2 w-full min-h-12 px-4 py-3 box-border leading-normal text-left m-0 rounded text-sm font-medium transition-colors duration-150 ${
                isActive ? 'bg-primary-100 text-primary-500' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <ShieldCheck size={24} className="inline-flex items-center justify-center w-6 h-6 align-middle shrink-0 m-0 box-border" />
            <span className="inline text-sm leading-[1.2] align-middle whitespace-nowrap overflow-hidden text-ellipsis flex-[1_1_auto] m-0 p-0 box-border">Gerenciar Planos</span>
          </NavLink>
        )}
      </ScrollableNav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 space-y-1 shrink-0">
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

      </div>
    </div>
  )
}
