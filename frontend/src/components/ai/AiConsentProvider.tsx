import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Loader2, ShieldCheck } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore, type AuthUser } from '@/stores/authStore'
import { ModalDialog } from '@/components/ui/ModalDialog'

interface AiConsentContextValue {
  /** `true` quando o usuário autorizou a versão atual do texto de consentimento. */
  consentimentoAtivo: boolean
  modalAberto: boolean
  salvando: boolean
  erro: string | null
  /** Abre o modal (se necessário) e resolve `true` somente após a autorização. */
  garantirConsentimento: () => Promise<boolean>
  solicitarConsentimento: () => void
  fechar: () => void
  aceitar: () => Promise<void>
  revogar: () => Promise<boolean>
}

const AiConsentContext = createContext<AiConsentContextValue | null>(null)

export function AiConsentProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [concordo, setConcordo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const pendentes = useRef<Array<(autorizado: boolean) => void>>([])

  const consentimentoAtivo = Boolean(
    user?.consentimento_ia_em &&
      (!user.consentimento_ia_versao_atual ||
        user.consentimento_ia_versao === user.consentimento_ia_versao_atual),
  )

  const abrir = useCallback(() => {
    setErro(null)
    setConcordo(false)
    setModalAberto(true)
  }, [])

  const solicitarConsentimento = useCallback(() => {
    if (!consentimentoAtivo) abrir()
  }, [abrir, consentimentoAtivo])

  const garantirConsentimento = useCallback(() => {
    if (consentimentoAtivo) return Promise.resolve(true)
    abrir()
    return new Promise<boolean>((resolve) => {
      pendentes.current.push(resolve)
    })
  }, [abrir, consentimentoAtivo])

  const resolverPendentes = useCallback((autorizado: boolean) => {
    const lista = pendentes.current
    pendentes.current = []
    lista.forEach((resolve) => resolve(autorizado))
  }, [])

  const fechar = useCallback(() => {
    setModalAberto(false)
    setErro(null)
    setConcordo(false)
    resolverPendentes(false)
  }, [resolverPendentes])

  // Versão do texto de consentimento (deve corresponder ao backend CONSENTIMENTO_IA_VERSAO_ATUAL)
  const CONSENTIMENTO_VERSAO = '2026-11-01'

  const aceitar = useCallback(async () => {
    setSalvando(true)
    setErro(null)
    try {
      const { data } = await api.post<AuthUser>('/usuarios/me/consentimento-ia', {
        aceito: true,
        versao: CONSENTIMENTO_VERSAO,
      })
      setUser(data)
      setModalAberto(false)
      setConcordo(false)
      resolverPendentes(true)
    } catch {
      setErro(
        'Não foi possível registrar sua autorização agora. Verifique sua conexão e tente novamente.',
      )
    } finally {
      setSalvando(false)
    }
  }, [resolverPendentes, setUser])

  const revogar = useCallback(async () => {
    setSalvando(true)
    setErro(null)
    try {
      const { data } = await api.post<AuthUser>('/usuarios/me/consentimento-ia', {
        aceito: false,
      })
      setUser(data)
      return true
    } catch {
      setErro('Não foi possível revogar a autorização agora. Tente novamente.')
      return false
    } finally {
      setSalvando(false)
    }
  }, [setUser])

  return (
    <AiConsentContext.Provider
      value={{
        consentimentoAtivo,
        modalAberto,
        salvando,
        erro,
        garantirConsentimento,
        solicitarConsentimento,
        fechar,
        aceitar,
        revogar,
      }}
    >
      {children}

      {modalAberto && (
        <ModalDialog
          title="Autorização para recursos de IA"
          subtitle="Leia antes de usar chat, Plano de Ação ou voz"
          onClose={fechar}
          size="lg"
        >
          <div className="p-4 space-y-4 text-sm text-gray-700 leading-relaxed">
            <div className="flex items-start gap-3 rounded-xl bg-primary-50 border border-primary-100 p-3">
              <ShieldCheck size={20} className="text-primary-500 shrink-0 mt-0.5" />
              <p className="text-primary-800">
                Os recursos de inteligência artificial do Equili enviam dados para um provedor
                terceiro. Nada é enviado antes da sua autorização.
              </p>
            </div>

            <section>
              <h3 className="font-semibold text-gray-900">Quais dados são enviados</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>As mensagens e perguntas que você escreve no Chat IA;</li>
                <li>A transcrição do seu áudio quando você usa o assistente de voz;</li>
                <li>
                  Um resumo dos seus dados financeiros (rendas, dívidas, contas a pagar e a
                  receber, saldos e investimentos) para personalizar as respostas.
                </li>
              </ul>
              <p className="mt-2 text-gray-600">
                Não enviamos seu nome, e-mail, senha, dados de cartão ou credenciais de acesso.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">Quem recebe</h3>
              <p className="mt-1">
                <strong>OpenRouter, Inc.</strong> (<span className="break-all">openrouter.ai</span>),
                que encaminha a solicitação para provedores de modelos de IA (atualmente NVIDIA e
                Google). O processamento pode ocorrer fora do Brasil, inclusive nos Estados Unidos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">Para que usamos</h3>
              <p className="mt-1">
                Gerar respostas no chat, montar seu Plano de Ação financeiro e interpretar comandos
                de voz. As respostas são geradas automaticamente e podem conter imprecisões; elas
                não substituem orientação financeira profissional.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">Seus controles</h3>
              <p className="mt-1">
                Você pode revogar esta autorização a qualquer momento em{' '}
                <strong>Configurações &gt; Privacidade (LGPD)</strong>. Sem a autorização, os
                recursos de IA ficam indisponíveis, mas o restante do app continua funcionando.
                Saiba mais na{' '}
                <Link
                  to="/privacidade"
                  onClick={fechar}
                  className="text-primary-500 font-medium hover:underline"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
            </section>

            {erro && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">
                {erro}
              </div>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={concordo}
                onChange={(e) => setConcordo(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary-500 shrink-0"
              />
              <span>
                Li as informações acima e <strong>autorizo</strong> o envio dos dados descritos
                para a OpenRouter e seus provedores de modelos de IA.
              </span>
            </label>

            <div className="modal-footer flex gap-2">
              <button
                type="button"
                onClick={fechar}
                disabled={salvando}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={aceitar}
                disabled={!concordo || salvando}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}
                Autorizar uso de IA
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </AiConsentContext.Provider>
  )
}

export function useAiConsent(): AiConsentContextValue {
  const contexto = useContext(AiConsentContext)
  if (!contexto) {
    throw new Error('useAiConsent deve ser usado dentro de AiConsentProvider.')
  }
  return contexto
}
