import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, User, Lock, LogOut, CheckCircle } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

// ─── Schema: editar perfil ────────────────────────────────────────────────────
const perfilSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
})

// ─── Schema: troca de senha ───────────────────────────────────────────────────
const senhaSchema = z
  .object({
    senha_atual: z.string().min(1, 'Informe sua senha atual'),
    nova_senha: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve ter ao menos uma letra maiúscula')
      .regex(/[0-9]/, 'Deve ter ao menos um número'),
    confirmar_senha: z.string(),
  })
  .refine((d) => d.nova_senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

type PerfilForm = z.infer<typeof perfilSchema>
type SenhaForm = z.infer<typeof senhaSchema>

// ─── Seção: editar perfil ─────────────────────────────────────────────────────
function SecaoPerfil() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    defaultValues: { nome: user?.nome ?? '', email: user?.email ?? '' },
  })

  async function onSubmit(data: PerfilForm) {
    setServerError(null)
    setSuccess(false)
    try {
      const res = await api.put('/usuarios/me', data)
      setUser(res.data)
      setSuccess(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setServerError(e.response?.data?.detail ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <User size={18} className="text-primary-500" />
        <h2 className="text-base font-semibold text-gray-800">Dados do perfil</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            type="text"
            autoComplete="name"
            className={`input-field ${errors.nome ? 'border-danger-500' : ''}`}
            {...register('nome')}
          />
          {errors.nome && <p className="mt-1 text-xs text-danger-500">{errors.nome.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
          <input
            type="email"
            autoComplete="email"
            className={`input-field ${errors.email ? 'border-danger-500' : ''}`}
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-danger-500">{errors.email.message}</p>}
        </div>

        {serverError && (
          <div className="rounded-lg bg-danger-100 border border-danger-200 px-3 py-2 text-sm text-danger-500">
            {serverError}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">
            <CheckCircle size={15} />
            Perfil atualizado com sucesso!
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary flex items-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Salvar alterações
        </button>
      </form>
    </section>
  )
}

// ─── Seção: trocar senha ──────────────────────────────────────────────────────
function SecaoSenha() {
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SenhaForm>({ resolver: zodResolver(senhaSchema) })

  async function onSubmit(data: SenhaForm) {
    setServerError(null)
    setSuccess(false)
    try {
      await api.put('/usuarios/me', {
        senha_atual: data.senha_atual,
        nova_senha: data.nova_senha,
      })
      setSuccess(true)
      reset()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setServerError(e.response?.data?.detail ?? 'Erro ao alterar senha. Tente novamente.')
    }
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={18} className="text-primary-500" />
        <h2 className="text-base font-semibold text-gray-800">Alterar senha</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Senha atual</label>
          <input
            type="password"
            autoComplete="current-password"
            className={`input-field ${errors.senha_atual ? 'border-danger-500' : ''}`}
            placeholder="••••••••"
            {...register('senha_atual')}
          />
          {errors.senha_atual && (
            <p className="mt-1 text-xs text-danger-500">{errors.senha_atual.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
          <input
            type="password"
            autoComplete="new-password"
            className={`input-field ${errors.nova_senha ? 'border-danger-500' : ''}`}
            placeholder="••••••••"
            {...register('nova_senha')}
          />
          {errors.nova_senha && (
            <p className="mt-1 text-xs text-danger-500">{errors.nova_senha.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
          <input
            type="password"
            autoComplete="new-password"
            className={`input-field ${errors.confirmar_senha ? 'border-danger-500' : ''}`}
            placeholder="••••••••"
            {...register('confirmar_senha')}
          />
          {errors.confirmar_senha && (
            <p className="mt-1 text-xs text-danger-500">{errors.confirmar_senha.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-lg bg-danger-100 border border-danger-200 px-3 py-2 text-sm text-danger-500">
            {serverError}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">
            <CheckCircle size={15} />
            Senha alterada com sucesso!
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary flex items-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Alterar senha
        </button>
      </form>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  async function handleLogout() {
    await api.post('/auth/logout').catch(() => {})
    logout()
    navigate('/login', { replace: true })
  }

  function avatarLetters(nome: string) {
    return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Configurações</h1>
        <p className="text-sm text-gray-500">Gerencie seu perfil e preferências</p>
      </div>

      {/* Avatar + plano */}
      {user && (
        <div className="card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {avatarLetters(user.nome)}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{user.nome}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-500 capitalize">
              Plano {user.plano}
            </span>
          </div>
        </div>
      )}

      <SecaoPerfil />
      <SecaoSenha />

      {/* Zona de perigo */}
      <section className="card p-6 border border-red-100">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Conta</h2>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          Sair da conta
        </button>
      </section>
    </div>
  )
}
