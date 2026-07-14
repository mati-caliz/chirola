import * as LocalAuthentication from 'expo-local-authentication';
import { getPreference, preferenceKeys, removePreference, setPreference } from '@/lib/storage';

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await getPreference(preferenceKeys.biometricLock)) === 'on';
}

export async function setBiometricLock(enabled: boolean): Promise<void> {
  if (enabled) {
    await setPreference(preferenceKeys.biometricLock, 'on');
  } else {
    await removePreference(preferenceKeys.biometricLock);
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloqueá Chirola',
    cancelLabel: 'Cancelar',
  });
  return result.success;
}
