import { useState } from 'react';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { registerSchema } from '@chirola/shared';
import { brandColor, Button, ErrorText, Screen, Subtitle, TextField, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterScreen() {
  const theme = useTheme();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    const parsed = registerSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }
    setSubmitting(true);
    try {
      await register(parsed.data.email, parsed.data.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 4, marginTop: 40 }}>
        <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.heading, color: theme.colors.textBrand }}>
          Chirola
        </Text>
        <Title>Crear cuenta</Title>
        <Subtitle>Registrate para empezar a facturar.</Subtitle>
      </View>
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
        placeholder="Mínimo 8 caracteres"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Crear cuenta" onPress={onSubmit} loading={submitting} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Subtitle>¿Ya tenés cuenta?</Subtitle>
        <Link href="/(auth)/login" replace>
          <Text style={{ color: brandColor, fontWeight: '600' }}>Iniciá sesión</Text>
        </Link>
      </View>
    </Screen>
  );
}
