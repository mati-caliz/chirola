import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'chirola:';

export const preferenceKeys = {
  activeIssuerId: 'activeIssuerId',
  colorSchemeOverride: 'colorSchemeOverride',
  onboardingSeen: 'onboardingSeen',
  biometricLock: 'biometricLock',
} as const;

export type PreferenceKey = (typeof preferenceKeys)[keyof typeof preferenceKeys];

export async function getPreference(key: PreferenceKey): Promise<string | null> {
  return AsyncStorage.getItem(`${PREFIX}${key}`);
}

export async function setPreference(key: PreferenceKey, value: string): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${key}`, value);
}

export async function removePreference(key: PreferenceKey): Promise<void> {
  await AsyncStorage.removeItem(`${PREFIX}${key}`);
}
