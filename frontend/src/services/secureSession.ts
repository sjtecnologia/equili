import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

/**
 * Guarda o refresh token no Keychain (iOS) / Keystore (Android).
 *
 * Por quê: no app nativo o WebView roda em `capacitor://localhost` (iOS) ou
 * `https://localhost` (Android) e não lê nem envia os cookies de refresh/CSRF
 * do domínio equili.com.br — ou seja, o fluxo de cookie que funciona na web
 * nunca funciona dentro do app. Sem um refresh token guardado no dispositivo,
 * o login com Face ID para contas sociais (Google/Apple, que não têm senha
 * salva no Keychain) não tem como restaurar a sessão.
 *
 * No web nada é gravado: quem cuida ali continua sendo o cookie httpOnly.
 */
const KEY_REFRESH_TOKEN = 'refresh_token'

export async function saveRefreshToken(token: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await SecureStorage.setItem(KEY_REFRESH_TOKEN, token)
  } catch (err) {
    console.warn('[sessão] falha ao salvar refresh token', err)
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    return await SecureStorage.getItem(KEY_REFRESH_TOKEN)
  } catch (err) {
    console.warn('[sessão] falha ao ler refresh token', err)
    return null
  }
}

export async function clearRefreshToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await SecureStorage.removeItem(KEY_REFRESH_TOKEN)
  } catch (err) {
    console.warn('[sessão] falha ao remover refresh token', err)
  }
}
