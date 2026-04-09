import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import logo from '@/assets/logo.png'

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
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const res = await api.post<{ access_token: string }>('/auth/register', data)
      setAccessToken(res.data.access_token)
      const me = await api.get('/usuarios/me', {
        headers: { Authorization: `Bearer ${res.data.access_token}` },
      })
      setUser(me.data)
      navigate('/onboarding', { replace: true })
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } }
      if (e.response?.status === 409) {
        setServerError('Este e-mail já está cadastrado. Tente fazer login.')
      } else {
        setServerError('Erro ao criar conta. Tente novamente.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logo} alt="Equili" className="h-24 w-auto mx-auto" />
          <p className="text-gray-500 mt-1 text-sm">Comece sua jornada ao equilíbrio</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Criar conta gratuita</h2>

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
