import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useAuthStore } from '@/stores/authStore'

function avatarLetters(nome: string) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  // Não usado diretamente, mas mantém o navigate disponível para futuros usos
  void navigate

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar — apenas desktop */}
      <aside className="hidden lg:flex">
        <Sidebar />
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        {/* Header mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
          <span className="text-xl font-bold text-primary-500">Equili</span>
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

        <div className="max-w-5xl mx-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav — apenas mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0">
        <BottomNav />
      </div>
    </div>
  )
}
