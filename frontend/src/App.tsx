import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useAuthStore } from '@/stores/authStore'

// Pages
import LoginPage from '@/pages/auth/LoginPage'
import CadastroPage from '@/pages/auth/CadastroPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import DividasPage from '@/pages/dividas/DividasPage'
import BaixasPage from '@/pages/dividas/BaixasPage'
import RendaPage from '@/pages/renda/RendaPage'
import MetasPage from '@/pages/metas/MetasPage'
import FamiliaPage from '@/pages/familia/FamiliaPage'
import PlanoAcaoPage from '@/pages/plano-de-acao/PlanoAcaoPage'
import OnboardingPage from '@/pages/onboarding/OnboardingPage'
import ContasPagarPage from '@/pages/contas-pagar/ContasPagarPage'
import CategoriasPage from '@/pages/categorias/CategoriasPage'
import ContasReceberPage from '@/pages/contas-receber/ContasReceberPage'
import ContasBancariasPage from '@/pages/contas-bancarias/ContasBancariasPage'
import ContaLancamentosPage from '@/pages/contas-bancarias/ContaLancamentosPage'
import CartaoLancamentosPage from '@/pages/contas-bancarias/CartaoLancamentosPage'
import RelatoriosPage from '@/pages/relatorios/RelatoriosPage'
import ConfiguracoesPage from '@/pages/configuracoes/ConfiguracoesPage'
import AppLayout from '@/components/layout/AppLayout'
import InstallBanner from '@/components/pwa/InstallBanner'
import ChatPage from '@/pages/chat/ChatPage'
import InvestimentosPage from '@/pages/investimentos/InvestimentosPage'
import AnimatedSplash from '@/components/shared/AnimatedSplash'
import ListasPage from '@/pages/listas/ListasPage'
import NfsPage from '@/pages/NfsPage'
import AdminUsuariosPage from '@/pages/admin/AdminUsuariosPage'
import PoliticaDePrivacidade from '@/pages/PoliticaDePrivacidade'
import PlanosPage from '@/pages/planos/PlanosPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status)
  if (status === 'loading') return null
  return status === 'authenticated' ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const status = useAuthStore((s) => s.status)
  const bootstrapSession = useAuthStore((s) => s.bootstrapSession)

  // Detecta novo SW disponível e força reload imediato
  useRegisterSW({
    onNeedRefresh() {
      window.location.reload()
    },
    onOfflineReady() {},
  })

  // Força limpeza de cache do SW antigo na primeira abertura de cada versão
  useEffect(() => {
    const APP_VERSION = '19'
    const stored = localStorage.getItem('app_cache_version')
    if (stored !== APP_VERSION) {
      localStorage.setItem('app_cache_version', APP_VERSION)
      // Desregistra todos os service workers e limpa todos os caches
      const cleanup = async () => {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map((r) => r.unregister()))
        }
        if ('caches' in window) {
          const names = await caches.keys()
          await Promise.all(names.map((n) => caches.delete(n)))
        }
        // Recarrega sem cache após limpeza
        window.location.reload()
      }
      cleanup().catch(() => {})
      return
    }
  }, [])

  // Configura StatusBar e NavigationBar nativas (Android/iOS)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.setStyle({ style: Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#2E7D5E' }).catch(() => {})
    // Barra de navegação inferior branca (Android)
    if (Capacitor.getPlatform() === 'android') {
      const statusBarWithNav = StatusBar as unknown as {
        setNavigationBarColor?: (o: { color: string }) => Promise<void>
      }
      statusBarWithNav.setNavigationBarColor?.({ color: '#ffffff' })?.catch(() => {})
    }
  }, [])

  useEffect(() => {
    bootstrapSession().catch(() => {})
  }, [bootstrapSession])

  return (
    <>
    <AnimatedSplash ready={status !== 'loading'} />
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/privacidade" element={<PoliticaDePrivacidade />} />

        {/* Rotas protegidas */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="renda" element={<RendaPage />} />
          <Route path="metas" element={<MetasPage />} />
          <Route path="familia" element={<FamiliaPage />} />
          <Route path="dividas" element={<DividasPage />} />
          <Route path="dividas/baixas" element={<BaixasPage />} />
          <Route path="contas-pagar" element={<ContasPagarPage />} />
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="contas-receber" element={<ContasReceberPage />} />
          <Route path="contas-bancarias" element={<ContasBancariasPage />} />
          <Route path="contas-bancarias/:contaId/lancamentos" element={<ContaLancamentosPage />} />
          <Route path="cartoes-credito/:cartaoId/lancamentos" element={<CartaoLancamentosPage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="planos" element={<PlanosPage />} />
          <Route path="plano-de-acao" element={<PlanoAcaoPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="investimentos" element={<InvestimentosPage />} />
          <Route path="listas" element={<ListasPage />} />
          <Route path="nfs" element={<NfsPage />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
          <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <InstallBanner />
    </BrowserRouter>
    </>
  )
}
