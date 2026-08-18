import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Screen, Segmented, Switch } from '@/components/ds';
import { useThemeMode, type ThemeMode } from '@/theme/theme-mode';
import {
  authenticateBiometric,
  isBiometricAvailable,
  isBiometricLockEnabled,
  setBiometricLock,
} from '@/lib/biometrics';
import { useTheme } from '@/hooks/use-theme';

const modeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function ConfigScreen() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
    isBiometricLockEnabled().then(setBiometricEnabled);
  }, []);

  const toggleBiometric = async (next: boolean) => {
    if (next) {
      const ok = await authenticateBiometric();
      if (!ok) return;
    }
    await setBiometricLock(next);
    setBiometricEnabled(next);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Configuración' }} />
      <Screen>
        <Card>
          <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.body, color: theme.colors.textPrimary, marginBottom: 4 }}>
            Apariencia
          </Text>
          <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, marginBottom: 12 }}>
            Elegí cómo se ve la app. «Sistema» sigue la configuración de tu teléfono.
          </Text>
          <Segmented<ThemeMode> value={mode} onChange={setMode} options={modeOptions} />
        </Card>

        {biometricAvailable ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.body, color: theme.colors.textPrimary }}>
                  Bloqueo con biometría
                </Text>
                <Text style={{ marginTop: 4, fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
                  Pedí tu huella o rostro cada vez que abrís la app.
                </Text>
              </View>
              <Switch checked={biometricEnabled} onChange={toggleBiometric} label="Bloqueo con biometría" />
            </View>
          </Card>
        ) : null}

        <View style={{ paddingHorizontal: 4 }}>
          <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textTertiary }}>
            Más opciones (notificaciones push, perfil) llegan pronto.
          </Text>
        </View>
      </Screen>
    </>
  );
}
