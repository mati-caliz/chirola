import { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  ErrorText,
  Label,
  Screen,
  Subtitle,
  TextField,
  Title,
} from '@/components/ui';
import { matchCertificate, generateCsr } from '@/lib/resources';

export default function CertificateScreen() {
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [alias, setAlias] = useState('');
  const [csrPem, setCsrPem] = useState<string | null>(null);
  const [certPem, setCertPem] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const csrMutation = useMutation({
    mutationFn: () => generateCsr(issuerId, alias.trim() || undefined),
    onSuccess: (res) => {
      setError(null);
      setCsrPem(res.csrPem);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo generar el CSR.'),
  });

  const certificateMutation = useMutation({
    mutationFn: () => matchCertificate(issuerId, certPem.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issuers'] });
      router.back();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo asociar el certificado.'),
  });

  async function copyCsr() {
    if (!csrPem) return;
    await Clipboard.setStringAsync(csrPem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Certificado ARCA' }} />
      <Screen>
        <View style={{ gap: 4 }}>
          <Title>Certificado ARCA</Title>
          <Subtitle>La clave privada se genera y queda cifrada en el servidor: nunca sale de ahí.</Subtitle>
        </View>

        <Card>
          <Label>Paso 1 · Generar el pedido (CSR)</Label>
          <TextField
            label="Alias en ARCA (opcional)"
            value={alias}
            onChangeText={setAlias}
            placeholder="Por defecto, la razón social"
            autoCapitalize="none"
          />
          <Button
            title={csrPem ? 'Regenerar CSR' : 'Generar CSR'}
            variant="secondary"
            onPress={() => csrMutation.mutate()}
            loading={csrMutation.isPending}
          />
        </Card>

        {csrPem ? (
          <Card>
            <Label>Paso 2 · Subí este CSR a ARCA</Label>
            <Subtitle>
              Copialo, subilo en ARCA (Administración de Certificados Digitales), asociá el
              servicio «wsfe» en el Administrador de Relaciones y descargá el .crt.
            </Subtitle>
            <TextField
              value={csrPem}
              multiline
              editable={false}
              style={{ minHeight: 140, fontFamily: 'monospace', fontSize: 11 }}
            />
            <Button
              title={copied ? '¡Copiado!' : 'Copiar CSR'}
              variant="secondary"
              onPress={copyCsr}
            />
          </Card>
        ) : null}

        <Card>
          <Label>Paso 3 · Pegá el certificado (.crt) de ARCA</Label>
          <TextField
            value={certPem}
            onChangeText={setCertPem}
            multiline
            placeholder={'-----BEGIN CERTIFICATE-----\n...'}
            autoCapitalize="none"
            style={{ minHeight: 140, fontFamily: 'monospace', fontSize: 11 }}
          />
          <Button
            title="Asociar certificado"
            onPress={() => {
              setError(null);
              if (certPem.trim().length === 0) {
                setError('Pegá el certificado descargado de ARCA.');
                return;
              }
              certificateMutation.mutate();
            }}
            loading={certificateMutation.isPending}
          />
        </Card>

        <ErrorText>{error}</ErrorText>
      </Screen>
    </>
  );
}
