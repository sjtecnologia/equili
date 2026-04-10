import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useAuthStore } from '@/stores/authStore'
import logo from '@/assets/logo.png'

function avatarLetters(nome: string) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  // Não usado diretamente, mas mantém o navigate disponível para futuros usos
  void navigate

  return (
    // h-screen + overflow-hidden = sem scroll externo; o scroll fica só dentro do <main>
    <div className="h-screen overflow-hidden bg-gray-100 flex">
      {/* Sidebar — apenas desktop */}
      <aside className="hidden lg:flex">
        <Sidebar />
      </aside>

      {/* Coluna principal: header + conteúdo + bottom nav empilhados */}
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Header mobile — não precisa de sticky, já fica no topo do flex */}
        <header className="lg:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 z-10">
          <img src={logo} alt="Equili" className="h-8 w-auto" />
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-600 font-medium hidden sm:block truncate max-w-[140px]">
                {user.nome}
              </span>
            )}
            <Link to="/configuracoes" aria-label="Configurações">
              {user ? (
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
                  {avatarLetters(user.nome)}
                </div>
              ) : (
                <Settings size={22} className="text-gray-500" />
              )}
            </Link>
          </div>
        </header>

        {/* Área de conteúdo: ocupa o espaço restante e rola internamente */}
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="lg:max-w-5xl lg:mx-auto lg:p-8">
            <Outlet />
          </div>
        </main>

        {/* Bottom Nav — apenas mobile, dentro do fluxo (não fixed) */}
        <div className="lg:hidden flex-shrink-0">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
