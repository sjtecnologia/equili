import { Capacitor } from '@capacitor/core'

/**
 * Base de TODAS as chamadas HTTP da API.
 *
 * No app nativo o WebView roda em `capacitor://localhost`. Caminhos relativos
 * (`/api/v1/...`) são atendidos pelo servidor de assets do Capacitor, que
 * devolve o próprio `index.html` (200) em vez de chegar ao backend — o que
 * silenciosamente corrompe as respostas (ex.: o usuário vira uma string HTML).
 * Por isso, no nativo usamos a URL absoluta de produção.
 *
 * Na web mantemos o caminho relativo (mesmo host do backend), o que preserva os
 * cookies httpOnly de sessão e o header CSRF.
 */
export const API_BASE_URL = Capacitor.isNativePlatform()
  ? 'https://equili.com.br/api/v1'
  : '/api/v1'
