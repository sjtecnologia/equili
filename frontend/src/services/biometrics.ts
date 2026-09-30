import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const BIOMETRIC_SERVER = 'equili.com.br';

export interface BiometricCredentials {
  username: string;
  password: string;
}

export async function isBiometricReady(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await NativeBiometric.isAvailable();
    if (!res.isAvailable) return false;
    await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER });
    return true;
  } catch {
    return false;
  }
}

export async function saveBiometricCredentials(username: string, password: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativeBiometric.setCredentials({ username, password, server: BIOMETRIC_SERVER });
  } catch (err) {
    console.error('[biometria] falha ao salvar credenciais', err);
  }
}

export async function biometricLogin(): Promise<BiometricCredentials | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Use a biometria para entrar no Equili.',
    });
  } catch (err: unknown) {
    const anyErr = err as { code?: string | number; message?: string };
    const msg = (String(anyErr?.code ?? '') + ' ' + String(anyErr?.message ?? '')).toLowerCase();
    if (
      anyErr?.code === 1 || anyErr?.code === '1' || anyErr?.code === 2 || anyErr?.code === '2' ||
      anyErr?.code === 10 || anyErr?.code === '10' ||
      msg.includes('cancel') || msg.includes('dismiss') || msg.includes('fallback') || msg.includes('not available')
    ) {
      return null;
    }
    console.error('[biometria] falha na autenticação', err);
    return null;
  }
  try {
    const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER });
    return { username: creds.username, password: creds.password };
  } catch (err) {
    console.error('[biometria] falha ao recuperar credenciais', err);
    return null;
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER });
  } catch (err) {
    console.error('[biometria] falha ao remover credenciais', err);
  }
}
