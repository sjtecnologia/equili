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
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1e1b4b',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e1b4b',
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1e1b4b',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#1e1b4b',
  },
};

export default config;
