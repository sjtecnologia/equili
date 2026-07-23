import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.equili.app',
  appName: 'Equili',
  webDir: 'dist',
  server: {
    // Em produção, carrega direto do site (updates sem precisar republicar na loja)
    url: 'https://equili.com.br',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      // Ocultado imediatamente — o splash animado em React cuida da transição
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#2E7D5E',
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
  },
};

export default config;
