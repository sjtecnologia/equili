import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'

// Pages
import LoginPage from '@/pages/auth/LoginPage'
import CadastroPage from '@/pages/auth/CadastroPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import DividasPage from '@/pages/dividas/DividasPage'
import BaixasPage from '@/pages/dividas/BaixasPage'
import RendaPage from '@/pages/renda/RendaPage'
import PlanoAcaoPage from '@/pages/plano-de-acao/PlanoAcaoPage'
import OnboardingPage from '@/pages/onboarding/OnboardingPage'
import ContasPagarPage from '@/pages/contas-pagar/ContasPagarPage'
import ContasReceberPage from '@/pages/contas-receber/ContasReceberPage'
import RelatoriosPage from '@/pages/relatorios/RelatoriosPage'
import ConfiguracoesPage from '@/pages/configuracoes/ConfiguracoesPage'
import AppLayout from '@/components/layout/AppLayout'
import InstallBanner from '@/components/pwa/InstallBanner'
import ChatPage from '@/pages/chat/ChatPage'
import InvestimentosPage from '@/pages/investimentos/InvestimentosPage'

function PrivateRoute({ children, ready }: { children: React.ReactNode; ready: boolean }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!ready) return null
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const [ready, setReady] = useState(false)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    axios
      .post('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then(async (res) => {
        setAccessToken(res.data.access_token)
        const me = await api.get('/usuarios/me', {
          headers: { Authorization: `Bearer ${res.data.access_token}` },
        })
        setUser(me.data)
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />

        {/* Rotas protegidas */}
        <Route
          path="/"
          element={
            <PrivateRoute ready={ready}>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="renda" element={<RendaPage />} />
          <Route path="dividas" element={<DividasPage />} />
          <Route path="dividas/baixas" element={<BaixasPage />} />
          <Route path="contas-pagar" element={<ContasPagarPage />} />
          <Route path="contas-receber" element={<ContasReceberPage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="plano-de-acao" element={<PlanoAcaoPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="investimentos" element={<InvestimentosPage />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <InstallBanner />
    </BrowserRouter>
  )
}
