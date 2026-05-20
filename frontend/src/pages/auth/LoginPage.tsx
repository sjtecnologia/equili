import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff, ScanFace } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { useBiometricAuth } from '@/hooks/useBiometricAuth'
import { useGoogleAuth } from '@/hooks/useGoogleAuth'
import logo from '@/assets/logo.png'

const IconGoogle = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe sua senha'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const authenticateWithToken = useAuthStore((s) => s.authenticateWithToken)
  const bootstrapSession = useAuthStore((s) => s.bootstrapSession)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const { getIdToken, loading: googleLoading } = useGoogleAuth()
  const [bioDisponivel, setBioDisponivel] = useState(false)
  const [bioHabilitado, setBioHabilitado] = useState(false)

  const bio = useBiometricAuth()
  const isNative = Capacitor.isNativePlatform()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!isNative) return
    Promise.all([bio.isDisponivel(), bio.isHabilitado()]).then(([disp, hab]) => {
      setBioDisponivel(disp)
      setBioHabilitado(hab)
    })
  }, [isNative])

  async function finalizarLogin(accessToken: string) {
    await authenticateWithToken(accessToken)
    navigate('/dashboard', { replace: true })
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const res = await api.post<{ access_token: string }>('/auth/login', data)

      if (isNative && bioDisponivel && !bioHabilitado) {
        const ok = window.confirm('Deseja habilitar o login com Face ID / biometria?')
        if (ok) await bio.habilitar()
      }

      await finalizarLogin(res.data.access_token)
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 401 || status === 403) {
        setServerError('E-mail ou senha incorretos. Tente novamente.')
      } else if (!status) {
        setServerError('Servidor indisponível. Tente novamente em instantes.')
      } else {
        setServerError('Erro ao entrar. Tente novamente.')
      }
    }
  }

  async function loginComBiometria() {
    setServerError(null)
    const ok = await bio.autenticarComBiometria()
    if (!ok) {
      setServerError('Biometria cancelada ou falhou.')
      return
    }
    try {
      const restored = await bootstrapSession()
      if (!restored) {
        setServerError('Sessão expirada. Faça login com e-mail e senha novamente.')
        return
      }
      navigate('/dashboard', { replace: true })
    } catch {
      setServerError('Sessão expirada. Faça login com e-mail e senha novamente.')
    }
  }

  async function loginGoogle() {
    setServerError(null)
    const { token, error } = await getIdToken()
    if (!token) {
      if (error) setServerError(error)
      return
    }
    try {
      const res = await api.post<{ access_token: string }>('/auth/google', { id_token: token })
      await finalizarLogin(res.data.access_token)
    } catch {
      setServerError('Erro ao entrar com Google. Tente novamente.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logo} alt="Equili" className="h-24 w-auto mx-auto" />
          <p className="text-gray-500 mt-1 text-sm">Equilíbrio financeiro para sua família</p>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Entrar na conta</h2>

          {isNative && bioDisponivel && bioHabilitado && (
            <button
              onClick={loginComBiometria}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-primary-500 text-primary-600 font-semibold hover:bg-primary-50 transition-colors"
            >
              <ScanFace size={20} />
              Entrar com Face ID
            </button>
          )}

          {isNative && (
            <button
              onClick={loginGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <IconGoogle />}
              Google
            </button>
          )}

          {isNative && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">ou com e-mail</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input-field ${errors.email ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="seu@email.com"
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-danger-500">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input-field pr-10 ${errors.senha ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                  placeholder="••••••••"
                  {...register('senha')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.senha && <p className="mt-1 text-xs text-danger-500">{errors.senha.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-lg bg-danger-100 border border-danger-200 px-3 py-2 text-sm text-danger-500">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="text-primary-500 font-medium hover:underline">
            Criar conta gratuita
          </Link>
        </p>
      </div>
    </div>
  )
}
