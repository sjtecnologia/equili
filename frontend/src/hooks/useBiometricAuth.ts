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
 *
 * Segurança: email e senha são armazenados via SecureStorage (iOS Keychain /
 * Android Keystore). Apenas o flag `bio_habilitado` usa Preferences (não sensível).
 */
import { Preferences } from '@capacitor/preferences'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'
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
    try {
      const { value } = await Preferences.get({ key: KEY_HABILITADO })
      return value === 'true'
    } catch {
      return false
    }
  }

  /**
   * Salva credenciais em SecureStorage (iOS Keychain / Android Keystore)
   * e marca biometria como habilitada em Preferences (flag não sensível).
   * Deve ser chamado APÓS login bem-sucedido com email/senha.
   */
  async function salvarCredenciais(email: string, senha: string): Promise<void> {
    try {
      await Promise.all([
        SecureStorage.setItem(KEY_EMAIL, email),
        SecureStorage.setItem(KEY_SENHA, senha),
        Preferences.set({ key: KEY_HABILITADO, value: 'true' }),
      ])
    } catch (err) {
      console.warn('[useBiometricAuth] Falha ao salvar credenciais:', err)
    }
  }

  /** Remove as credenciais salvas e desabilita login biométrico */
  async function desabilitar(): Promise<void> {
    try {
      await Promise.all([
        SecureStorage.removeItem(KEY_EMAIL),
        SecureStorage.removeItem(KEY_SENHA),
        Preferences.set({ key: KEY_HABILITADO, value: 'false' }),
      ])
    } catch (err) {
      console.warn('[useBiometricAuth] Falha ao remover credenciais:', err)
    }
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

      const [email, senha] = await Promise.all([
        SecureStorage.getItem(KEY_EMAIL),
        SecureStorage.getItem(KEY_SENHA),
      ])

      if (!email || !senha) return null
      return { email, senha }
    } catch {
      return null
    }
  }

  return { isDisponivel, isHabilitado, salvarCredenciais, desabilitar, autenticarComBiometria }
}
