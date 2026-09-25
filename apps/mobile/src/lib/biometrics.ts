import * as LocalAuthentication from "expo-local-authentication";
import { getPreference, preferenceKeys, removePreference, setPreference } from "@/lib/storage";

const BIOMETRIC_LOCK_ON = "on";

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await getPreference(preferenceKeys.biometricLock)) === BIOMETRIC_LOCK_ON;
}

async function enableBiometricLock(): Promise<void> {
  await setPreference(preferenceKeys.biometricLock, BIOMETRIC_LOCK_ON);
}

async function disableBiometricLock(): Promise<void> {
  await removePreference(preferenceKeys.biometricLock);
}

const biometricLockUpdaters: Record<"enabled" | "disabled", () => Promise<void>> = {
  enabled: enableBiometricLock,
  disabled: disableBiometricLock,
};

export async function setBiometricLock(enabled: boolean): Promise<void> {
  await biometricLockUpdaters[enabled ? "enabled" : "disabled"]();
}

export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Desbloqueá Chirola",
    cancelLabel: "Cancelar",
  });
  return result.success;
}
