import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Settings, Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import DrawerNav from './DrawerNav'
import VoiceButton from '@/components/shared/VoiceButton'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { useAuthStore } from '@/stores/authStore'
import logo from '@/assets/logo.png'

function avatarLetters(nome: string) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    // 100dvh = dynamic viewport height, certo em iOS WebView
    <div className="overflow-hidden bg-gray-100 flex" style={{ height: '100dvh' }}>
      <DrawerNav open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {/* Sidebar — apenas desktop */}
      <aside className="hidden lg:flex print:hidden">
        <Sidebar />
      </aside>

      {/* Coluna principal: h-full para herdar a altura do pai */}
      <div className="flex flex-col flex-1 h-full">
        {/* Header mobile */}
        <header className="lg:hidden print:hidden flex-shrink-0 flex items-center justify-between px-4 bg-white border-b border-gray-100 z-10"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: '12px' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <img src={logo} alt="Equili" className="h-8 w-auto" />
          </div>
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

        {/* min-h-0 aqui é essencial: permite que o flex-1 encolha no iOS WebKit */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="lg:max-w-5xl lg:mx-auto lg:p-8">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        {/* Bottom Nav — padding-bottom para o home indicator do iPhone */}
        <div className="lg:hidden print:hidden flex-shrink-0"
          style={{ backgroundColor: '#ffffff', paddingBottom: 'env(safe-area-inset-bottom)', borderTop: 'none' }}>
          <BottomNav />
        </div>
      </div>

      {/* Botão de voz flutuante — aparece quando logado */}
      <div className="print:hidden"><VoiceButton /></div>
    </div>
  )
}
