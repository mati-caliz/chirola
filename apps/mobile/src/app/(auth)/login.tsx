import { useState } from 'react';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { loginSchema } from '@chirola/shared';
import { brandColor, Button, ErrorText, Screen, Subtitle, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';

const Wordmark = ({ tagline }: { tagline: string }) => {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, marginTop: 48, marginBottom: 8 }}>
      <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.amount, color: theme.colors.textBrand }}>
        Chirola
      </Text>
      <Subtitle>{tagline}</Subtitle>
    </View>
  );
};

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }
    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Wordmark tagline="La forma humana de facturar." />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="vos@ejemplo.com"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Iniciar sesión" onPress={onSubmit} loading={submitting} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Subtitle>¿No tenés cuenta?</Subtitle>
        <Link href="/(auth)/register" replace>
          <Text style={{ color: brandColor, fontWeight: '600' }}>Registrate</Text>
        </Link>
      </View>
    </Screen>
  );
}
