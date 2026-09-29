import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, Loader2, Lock, LogOut, ShieldCheck, Trash2, User, CheckCircle, Bell, Smartphone, Check, Mic } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useVoiceStore } from '@/stores/voiceStore'
import { ALL_NAV_ITEMS } from '@/config/navItems'
import PushNotificationToggle from '@/components/pwa/PushNotificationToggle'
import { PageHeader } from '@/components/ui/PageHeader'
import { usePerfil } from '@/hooks/usePerfil'
import { parseApiError } from '@/utils/api'

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
  const { salvarPerfil } = usePerfil()
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
      await salvarPerfil(data)
      setSuccess(true)
    } catch (err: unknown) {
      setServerError(parseApiError(err) ?? 'Erro ao salvar. Tente novamente.')
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
  const { alterarSenha } = usePerfil()
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
      await alterarSenha({ senha_atual: data.senha_atual, nova_senha: data.nova_senha })
      setSuccess(true)
      reset()
    } catch (err: unknown) {
      setServerError(parseApiError(err) ?? 'Erro ao alterar senha. Tente novamente.')
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

// ─── Seção: Menu do rodé configurável ────────────────────────────────────────────
function SecaoNavRodape() {
  const { shortcuts, setShortcuts } = useNavStore()

  const toggle = (to: string) => {
    if (shortcuts.includes(to)) {
      if (shortcuts.length <= 1) return // mínimo 1
      setShortcuts(shortcuts.filter((s) => s !== to))
    } else {
      if (shortcuts.length >= 5) return // máximo 5
      setShortcuts([...shortcuts, to])
    }
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone size={18} className="text-primary-500" />
        <h2 className="text-base font-semibold text-gray-800">Menu do rodé</h2>
      </div>
      <p className="text-xs text-gray-500">
        Escolha até 5 atalhos que aparecerão na barra inferior.
        Toque para selecionar ou remover.
        <span className="font-medium text-primary-500"> {shortcuts.length}/5 selecionados</span>
      </p>
      <div className="space-y-2">
        {ALL_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const selected = shortcuts.includes(to)
          const disabled = !selected && shortcuts.length >= 5
          return (
            <button
              key={to}
              onClick={() => toggle(to)}
              disabled={disabled}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                selected
                  ? 'border-primary-400 bg-primary-50'
                  : disabled
                  ? 'border-gray-200 opacity-40 cursor-not-allowed'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} className={selected ? 'text-primary-500' : 'text-gray-400'} />
              <span className="flex-1 text-sm font-medium text-gray-700">{label}</span>
              {selected && <Check size={16} className="text-primary-500 shrink-0" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ToggleConfig({
  enabled,
  onToggle,
  title,
  description,
}: {
  enabled: boolean
  onToggle: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
      aria-pressed={enabled}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <span
        className={`w-11 h-6 rounded-full p-0.5 transition-colors ${enabled ? 'bg-primary-500' : 'bg-gray-300'}`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </span>
    </button>
  )
}

function SecaoAssistenteVoz() {
  const autoListenEnabled = useVoiceStore((s) => s.autoListenEnabled)
  const voiceConfirmationEnabled = useVoiceStore((s) => s.voiceConfirmationEnabled)
  const setAutoListenEnabled = useVoiceStore((s) => s.setAutoListenEnabled)
  const setVoiceConfirmationEnabled = useVoiceStore((s) => s.setVoiceConfirmationEnabled)

  return (
    <section className="card p-6 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Mic size={18} className="text-primary-500" />
        <h2 className="text-base font-semibold text-gray-800">Assistente de voz</h2>
      </div>
      <p className="text-sm text-gray-500">
        Ajuste como o assistente escuta e confirma os comandos por fala.
      </p>

      <div className="space-y-2">
        <ToggleConfig
          enabled={autoListenEnabled}
          onToggle={() => setAutoListenEnabled(!autoListenEnabled)}
          title="Escuta automática"
          description="Quando o app estiver aberto, o microfone entra em escuta sem apertar o botão."
        />
        <ToggleConfig
          enabled={voiceConfirmationEnabled}
          onToggle={() => setVoiceConfirmationEnabled(!voiceConfirmationEnabled)}
          title="Confirmação por voz"
          description="Após entender o comando, o app pergunta por áudio e você confirma falando sim ou não."
        />
      </div>
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
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <PageHeader title="Configurações" subtitle="Gerencie seu perfil e preferências" />

      {/* Avatar + plano */}
      {user && (
        <div className="card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {avatarLetters(user.nome)}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{user.nome}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      )}

      <SecaoPerfil />
      <SecaoSenha />
      <SecaoAssistenteVoz />
      <SecaoNavRodape />

      {/* Notificações push */}
      <section className="card p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={18} className="text-primary-500" />
          <h2 className="text-base font-semibold text-gray-800">Notificações</h2>
        </div>
        <p className="text-sm text-gray-500">Receba alertas de vencimento diretamente no seu dispositivo, mesmo sem abrir o app.</p>
        <PushNotificationToggle />
      </section>

      {/* LGPD — Privacidade e dados */}
      <SecaoPrivacidade />

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


// ─── Seção LGPD: Privacidade ──────────────────────────────────────────────────
function SecaoPrivacidade() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { exportarDados, excluirConta } = usePerfil()
  const [exportando, setExportando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleExportar() {
    setExportando(true)
    try {
      await exportarDados()
    } catch {
      setErro('Erro ao exportar dados. Tente novamente.')
    } finally {
      setExportando(false)
    }
  }

  async function handleExcluirConta() {
    setErro(null)
    setExcluindo(true)
    try {
      await excluirConta(senha, confirmacaoTexto)
      logout()
      navigate('/login', { replace: true })
    } catch (e: unknown) {
      setErro(parseApiError(e) ?? 'Erro ao excluir conta.')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary-500" />
        <h2 className="text-base font-semibold text-gray-800">Privacidade (LGPD)</h2>
      </div>
      <p className="text-sm text-gray-500">
        Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito de acessar,
        exportar e solicitar a exclusão dos seus dados pessoais.
      </p>
      <Link
        to="/privacidade"
        className="block text-sm font-medium text-primary-500 hover:underline"
      >
        Política de Privacidade
      </Link>

      {/* Exportar dados */}
      <button
        onClick={handleExportar}
        disabled={exportando}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 w-full"
      >
        {exportando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Exportar meus dados (JSON)
      </button>

      {/* Excluir conta */}
      {!confirmarExclusao ? (
        <button
          onClick={() => setConfirmarExclusao(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors w-full"
        >
          <Trash2 size={16} />
          Excluir minha conta e todos os dados
        </button>
      ) : (
        <div className="space-y-3 border border-red-200 rounded-xl p-4 bg-red-50">
          <p className="text-sm font-medium text-red-700">
            Atenção: esta ação é irreversível. Todos os seus dados serão apagados permanentemente.
          </p>
          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="input-field text-sm"
          />
          <input
            type="text"
            placeholder='Digite: EXCLUIR MINHA CONTA'
            value={confirmacaoTexto}
            onChange={(e) => setConfirmacaoTexto(e.target.value)}
            className="input-field text-sm"
          />
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirmarExclusao(false); setErro(null); setSenha(''); setConfirmacaoTexto('') }}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleExcluirConta}
              disabled={excluindo || confirmacaoTexto !== 'EXCLUIR MINHA CONTA'}
              className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Confirmar exclusão
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
