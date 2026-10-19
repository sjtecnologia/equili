import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'br.com.equili.app',
  appName: 'Equili',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: {
      // Fallback alto: o AnimatedSplash chama hide() quando o React monta.
      // O auto-hide do iOS usa 500ms por padrão e descia antes do JS em
      // first launch, logando "automatically hidden after default timeout".
      launchShowDuration: 8000
    }
  }
};
export default config;
