/**
 * useBiometricAuth — Hook para login com Face ID / Touch ID / biometria Android.
 *
 * Fluxo:
 * 1. Após login com email/senha, chama `habilitar()` para marcar que o usuário
 *    deseja usar biometria neste dispositivo.
 * 2. Na tela de login, chama `autenticarComBiometria()` para:
 *    a) autenticar com Face ID / Touch ID no OS
 *    b) liberar tentativa de restauração de sessão via refresh cookie (backend)
 *
 * Segurança: não armazena senha localmente. Apenas o flag `bio_habilitado`
 * é salvo em Preferences (não sensível).
 */
import { Preferences } from '@capacitor/preferences'
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth'
import { Capacitor } from '@capacitor/core'

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

  /** Marca biometria como habilitada neste dispositivo. */
  async function habilitar(): Promise<void> {
    try {
      await Preferences.set({ key: KEY_HABILITADO, value: 'true' })
    } catch (err) {
      console.warn('[useBiometricAuth] Falha ao habilitar biometria:', err)
    }
  }

  /** Desabilita login biométrico */
  async function desabilitar(): Promise<void> {
    try {
      await Preferences.set({ key: KEY_HABILITADO, value: 'false' })
    } catch (err) {
      console.warn('[useBiometricAuth] Falha ao desabilitar biometria:', err)
    }
  }

  /** Autentica com biometria no sistema operacional. */
  async function autenticarComBiometria(): Promise<boolean> {
    try {
      await BiometricAuth.authenticate({
        reason: 'Confirme sua identidade para acessar o Equili',
        cancelTitle: 'Usar senha',
        allowDeviceCredential: true,
      })
      return true
    } catch {
      return false
    }
  }

  return { isDisponivel, isHabilitado, habilitar, desabilitar, autenticarComBiometria }
}
