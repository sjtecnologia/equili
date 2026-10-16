import { useState } from 'react'
import { Capacitor } from '@capacitor/core'

interface GoogleAuthResult {
  token: string | null
  /** Mensagem de erro legível, ou `null` se cancelado pelo usuário ou sucesso. */
  error: string | null
}

/** Garante que `GoogleSignIn.initialize()` seja chamado só uma vez por sessão. */
let initialized = false

/**
 * Hook que encapsula o fluxo de autenticação com Google via Capacitor GoogleAuth.
 * Substitui as funções `loginGoogle()` e `cadastroGoogle()` — idênticas em LoginPage e CadastroPage.
 *
 * @returns `{ getIdToken, loading }`
 */
export function useGoogleAuth() {
  const [loading, setLoading] = useState(false)

  /**
   * Inicializa o plugin GoogleSignIn UMA vez antes do primeiro signIn().
   *
   * Sem isso, o SDK do Google lança uma NSException não tratada
   * ("No active configuration. Make sure GIDClientID is set in Info.plist.")
   * e derruba o app instantaneamente — um try/catch em JS não consegue interceptar.
   */
  async function ensureInitialized(): Promise<void> {
    const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in')
    if (!initialized) {
      await GoogleSignIn.initialize({
        clientId: import.meta.env.VITE_GOOGLE_SERVER_CLIENT_ID ?? '',
      })
      initialized = true
    }
  }

  /**
   * Executa o fluxo Google Sign-In.
   * Retorna `{ token, error }` — token = null em caso de cancelamento/erro.
   * Cancelamentos do usuário retornam `{ token: null, error: null }` (silencioso).
   */
  async function getIdToken(): Promise<GoogleAuthResult> {
    if (!Capacitor.isNativePlatform()) {
      return { token: null, error: 'Login com Google disponível apenas no app mobile.' }
    }

    setLoading(true)
    try {
      const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in')
      await ensureInitialized()
      const gUser = await GoogleSignIn.signIn()
      const token = gUser.idToken
      if (!token) throw new Error('Token Google não recebido.')
      return { token, error: null }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'SIGN_IN_CANCELED' || err.message?.toLowerCase().includes('cancel')) {
        return { token: null, error: null }
      }
      return { token: null, error: 'Erro ao autenticar com Google. Tente novamente.' }
    } finally {
      setLoading(false)
    }
  }

  return { getIdToken, loading }
}
