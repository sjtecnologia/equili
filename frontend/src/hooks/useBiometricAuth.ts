/**
 * useBiometricAuth — Hook para login com Face ID / Touch ID / biometria Android.
 *
 * Fluxo:
 * 1. Após login com email/senha, chama `salvarCredenciais(email, senha)` para armazenar
 *    as credenciais de forma associada ao check biométrico.
 * 2. Na tela de login, chama `autenticarComBiometria()` para:
 *    a) autenticar com Face ID / Touch ID no OS
 *    b) recuperar credenciais salvas
 *    c) retornar { email, senha } para o caller fazer o login
 */
import { Preferences } from '@capacitor/preferences'
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth'
import { Capacitor } from '@capacitor/core'

const KEY_EMAIL = 'bio_email'
const KEY_SENHA = 'bio_senha'
const KEY_HABILITADO = 'bio_habilitado'

export function useBiometricAuth() {
  /** Verifica se o dispositivo suporta biometria */
  async function isDisponivel(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false
    try {
      const { isAvailable, biometryType } = await BiometricAuth.checkBiometry()
      return isAvailable && biometryType !== BiometryType.none
    } catch {
      return false
    }
  }

  /** Verifica se o usuário já habilitou o login biométrico */
  async function isHabilitado(): Promise<boolean> {
    const { value } = await Preferences.get({ key: KEY_HABILITADO })
    return value === 'true'
  }

  /**
   * Salva credenciais localmente e marca biometria como habilitada.
   * Deve ser chamado APÓS login bem-sucedido com email/senha.
   */
  async function salvarCredenciais(email: string, senha: string): Promise<void> {
    await Promise.all([
      Preferences.set({ key: KEY_EMAIL, value: email }),
      Preferences.set({ key: KEY_SENHA, value: senha }),
      Preferences.set({ key: KEY_HABILITADO, value: 'true' }),
    ])
  }

  /** Remove as credenciais salvas e desabilita login biométrico */
  async function desabilitar(): Promise<void> {
    await Promise.all([
      Preferences.remove({ key: KEY_EMAIL }),
      Preferences.remove({ key: KEY_SENHA }),
      Preferences.set({ key: KEY_HABILITADO, value: 'false' }),
    ])
  }

  /**
   * Autentica com biometria e retorna as credenciais salvas.
   * @returns { email, senha } ou null se falhar
   */
  async function autenticarComBiometria(): Promise<{ email: string; senha: string } | null> {
    try {
      await BiometricAuth.authenticate({
        reason: 'Confirme sua identidade para acessar o Equili',
        cancelTitle: 'Usar senha',
        allowDeviceCredential: true,
      })

      const [{ value: email }, { value: senha }] = await Promise.all([
        Preferences.get({ key: KEY_EMAIL }),
        Preferences.get({ key: KEY_SENHA }),
      ])

      if (!email || !senha) return null
      return { email, senha }
    } catch {
      return null
    }
  }

  return { isDisponivel, isHabilitado, salvarCredenciais, desabilitar, autenticarComBiometria }
}
