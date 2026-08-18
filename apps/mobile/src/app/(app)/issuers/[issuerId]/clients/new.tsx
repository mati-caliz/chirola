import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClientSchema, DocumentType } from '@chirola/shared';
import { Banner, Button, Input, Screen, Segmented, Subtitle } from '@/components/ds';
import { createClient } from '@/lib/resources';

export default function NewClientScreen() {
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [docType, setDocType] = useState<number>(DocumentType.CUIT);
  const [docNumber, setDocNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: ReturnType<typeof createClientSchema.parse>) => createClient(issuerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients', issuerId] });
      router.back();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear el cliente.'),
  });

  const onSubmit = () => {
    setError(null);
    const parsed = createClientSchema.safeParse({
      docType,
      docNumber,
      legalName: legalName.trim() || undefined,
      email: email.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados.');
      return;
    }
    mutation.mutate(parsed.data);
  };

  const isCuitCuil = docType === DocumentType.CUIT || docType === DocumentType.CUIL;

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo cliente' }} />
      <Screen>
        <Subtitle>Los receptores que después vas a poder elegir al facturar.</Subtitle>
        {error ? <Banner kind="error" title="Revisá los datos" body={error} /> : null}
        <Segmented<number>
          label="Tipo de documento"
          value={docType}
          onChange={setDocType}
          options={[
            { label: 'CUIT', value: DocumentType.CUIT },
            { label: 'CUIL', value: DocumentType.CUIL },
            { label: 'DNI', value: DocumentType.DNI },
            { label: 'Cons. Final', value: DocumentType.CONSUMIDOR_FINAL },
          ]}
        />
        <Input
          label={isCuitCuil ? 'Número (11 dígitos)' : 'Número de documento'}
          value={docNumber}
          onChangeText={setDocNumber}
          keyboardType="number-pad"
          mono
          placeholder={isCuitCuil ? '20123456789' : '12345678'}
          hint={isCuitCuil ? 'Sin guiones. Necesario para emitir Factura A.' : undefined}
        />
        <Input
          label="Razón social / Nombre"
          value={legalName}
          onChangeText={setLegalName}
          placeholder="Opcional"
        />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Opcional"
          hint="Para enviarle el comprobante más tarde."
        />
        <Button variant="primary" full loading={mutation.isPending} onPress={onSubmit}>
          Crear cliente
        </Button>
      </Screen>
    </>
  );
}
