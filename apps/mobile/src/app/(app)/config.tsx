import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Screen, Segmented } from '@/components/ds';
import { useThemeMode, type ThemeMode } from '@/theme/theme-mode';
import { useTheme } from '@/hooks/use-theme';

const modeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function ConfigScreen() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();

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
        <View style={{ paddingHorizontal: 4 }}>
          <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textTertiary }}>
            Más opciones (biometría, notificaciones) llegan pronto.
          </Text>
        </View>
      </Screen>
    </>
  );
}
