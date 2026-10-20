import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { AppleSignIn, SignInScope } from '@capawesome/capacitor-apple-sign-in'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { useGoogleAuth } from '@/hooks/useGoogleAuth'
import { parseApiError } from '@/utils/api'
import logo from '@/assets/logo.png'

const IconGoogle = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const IconApple = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
    <path
      fill="currentColor"
      d="M16.36 1.43c0 1.16-.44 2.23-1.31 3.18-.93 1.02-2.02 1.6-3.19 1.5-.14-1.11.42-2.3 1.25-3.15.91-.94 2.22-1.61 3.25-1.53ZM20.58 17.33c-.46 1.06-.68 1.54-1.27 2.48-.82 1.25-1.97 2.82-3.4 2.84-1.27.02-1.6-.82-3.33-.81-1.73.01-2.1.84-3.37.82-1.43-.02-2.52-1.42-3.34-2.68-2.28-3.49-2.52-7.58-1.11-9.76 1-1.55 2.58-2.46 4.07-2.46 1.52 0 2.47.83 3.72.83 1.22 0 1.96-.83 3.72-.83 1.33 0 2.74.72 3.74 1.98-3.29 1.81-2.76 6.5.57 7.59Z"
    />
  </svg>
)

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Deve ter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve ter pelo menos um número'),
})

type FormData = z.infer<typeof schema>

export default function CadastroPage() {
  const navigate = useNavigate()
  const authenticateWithToken = useAuthStore((s) => s.authenticateWithToken)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const { getIdToken, loading: googleLoading } = useGoogleAuth()
  const [appleLoading, setAppleLoading] = useState(false)

  const isNative = Capacitor.isNativePlatform()

  async function finalizarLogin(accessToken: string) {
    await authenticateWithToken(accessToken)
    // Habilita o login por biometria caso o dispositivo suporte e o usuário
    // ainda não tenha marcado. Para fluxos sociais não temos senha para salvar
    // no Keychain; o botão "Entrar com Face ID" usa `bootstrapSession`.
    try {
      if (isNative && bioDisponivel && !bioHabilitado) {
        const ok = window.confirm('Deseja habilitar o login com Face ID / biometria?')
        if (ok) await bio.habilitar()
      }
    } catch (err) {
      console.warn('[biometria] falha ao habilitar após login social', err)
    }
    navigate('/onboarding', { replace: true })
  }

  async function cadastroGoogle() {
    setServerError(null)
    const { token, error } = await getIdToken()
    if (!token) {
      if (error) setServerError(error)
      return
    }
    try {
      const res = await api.post<{ access_token: string }>('/auth/google', { id_token: token })
      await finalizarLogin(res.data.access_token)
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      console.error('[CADASTRO_SOCIAL_DEBUG] google', e)
      setServerError(typeof detail === 'string' ? detail : 'Erro ao entrar com Google. Tente novamente.')
    }
  }

  async function cadastroApple() {
    setServerError(null)
    setAppleLoading(true)
    try {
      const result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
        redirectUrl: 'https://equili.com.br',
      })
      // A Apple só entrega nome/e-mail na PRIMEIRA autorização do app; enviamos
      // o nome ao backend para preencher `usuarios.nome` no cadastro automático.
      const fullName = [result.givenName, result.familyName].filter(Boolean).join(' ').trim()
      const res = await api.post<{ access_token: string }>('/auth/apple', {
        identity_token: result.idToken,
        full_name: fullName || null,
      })
      await finalizarLogin(res.data.access_token)
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      console.error('[CADASTRO_SOCIAL_DEBUG] apple', e)
      setServerError(typeof detail === 'string' ? detail : 'Erro ao entrar com Apple. Tente novamente.')
    } finally {
      setAppleLoading(false)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const res = await api.post<{ access_token: string }>('/auth/register', data)
      await finalizarLogin(res.data.access_token)
    } catch (err) {
      setServerError(parseApiError(err))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logo} alt="Equili" className="h-24 w-auto mx-auto" />
          <p className="text-gray-500 mt-1 text-sm">Comece sua jornada ao equilíbrio</p>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Criar conta gratuita</h2>

          {isNative && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={cadastroGoogle}
                disabled={googleLoading || appleLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <IconGoogle />}
                Continuar com Google
              </button>
              <button
                type="button"
                onClick={cadastroApple}
                disabled={googleLoading || appleLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {appleLoading ? <Loader2 size={16} className="animate-spin" /> : <IconApple />}
                Continuar com Apple
              </button>
            </div>
          )}

          {isNative && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">ou crie com e-mail</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                Nome
              </label>
              <input
                id="nome"
                type="text"
                autoComplete="name"
                className={`input-field ${errors.nome ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="Seu nome"
                {...register('nome')}
              />
              {errors.nome && (
                <p className="mt-1 text-xs text-danger-500">{errors.nome.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input-field ${errors.email ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="seu@email.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-danger-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`input-field pr-10 ${errors.senha ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                  placeholder="Mín. 8 chars, 1 maiúscula, 1 número"
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
              {errors.senha && (
                <p className="mt-1 text-xs text-danger-500">{errors.senha.message}</p>
              )}
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
              {isSubmitting ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            Ao criar conta, você concorda com nossos{' '}
            <a href="#" className="text-primary-500 hover:underline">
              Termos de Uso
            </a>{' '}
            e{' '}
            <a href="#" className="text-primary-500 hover:underline">
              Política de Privacidade
            </a>
            .
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Já tem conta?{' '}
          <Link to="/login" className="text-primary-500 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
