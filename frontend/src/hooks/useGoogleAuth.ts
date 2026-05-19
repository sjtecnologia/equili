import { useState } from 'react'
import { Capacitor } from '@capacitor/core'

interface GoogleAuthResult {
  token: string | null
  /** Mensagem de erro legível, ou `null` se cancelado pelo usuário ou sucesso. */
  error: string | null
}

/**
 * Hook que encapsula o fluxo de autenticação com Google via Capacitor GoogleAuth.
 * Substitui as funções `loginGoogle()` e `cadastroGoogle()` — idênticas em LoginPage e CadastroPage.
 *
 * @returns `{ getIdToken, loading }`
 */
export function useGoogleAuth() {
  const [loading, setLoading] = useState(false)

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
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')
      const gUser = await GoogleAuth.signIn()
      const token = gUser.authentication.idToken
      if (!token) throw new Error('Token Google não recebido.')
      return { token, error: null }
    } catch (e: unknown) {
      const err = e as { message?: string }
      if (err.message?.includes('cancel')) return { token: null, error: null }
      return { token: null, error: 'Erro ao autenticar com Google. Tente novamente.' }
    } finally {
      setLoading(false)
    }
  }

  return { getIdToken, loading }
}
