import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar — apenas desktop */}
      <aside className="hidden lg:flex">
        <Sidebar />
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
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
