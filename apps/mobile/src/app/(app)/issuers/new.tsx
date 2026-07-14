import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createIssuerSchema, type CreateIssuer } from '@chirola/shared';
import { Banner, Button, Input, Screen, Segmented, Subtitle } from '@/components/ds';
import { createIssuer } from '@/lib/resources';

type IvaCondition = CreateIssuer['ivaCondition'];
type Environment = CreateIssuer['environment'];

export default function NewIssuerScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [cuit, setCuit] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ivaCondition, setIvaCondition] = useState<IvaCondition>('RESPONSABLE_INSCRIPTO');
  const [environment, setEnvironment] = useState<Environment>('homologacion');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createIssuer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issuers'] });
      router.back();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear el emisor.'),
  });

  const onSubmit = () => {
    setError(null);
    const parsed = createIssuerSchema.safeParse({ cuit, legalName, ivaCondition, environment });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá los datos ingresados.');
      return;
    }
    mutation.mutate(parsed.data);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo emisor' }} />
      <Screen>
        <Subtitle>Un emisor es el CUIT en cuyo nombre vas a facturar.</Subtitle>
        {error ? <Banner kind="error" title="Revisá los datos" body={error} /> : null}
        <Input
          label="CUIT"
          value={cuit}
          onChangeText={setCuit}
          keyboardType="number-pad"
          mono
          placeholder="20123456789"
          hint="Los 11 dígitos sin guiones, como figuran en ARCA."
        />
        <Input
          label="Razón social"
          value={legalName}
          onChangeText={setLegalName}
          placeholder="Juan Pérez"
          hint="El nombre que va a aparecer en tus facturas."
        />
        <Segmented<IvaCondition>
          label="Condición frente al IVA"
          value={ivaCondition}
          onChange={setIvaCondition}
          options={[
            { label: 'Resp. Inscripto', value: 'RESPONSABLE_INSCRIPTO' },
            { label: 'Monotributo', value: 'MONOTRIBUTO' },
            { label: 'Exento', value: 'EXENTO' },
          ]}
        />
        <Segmented<Environment>
          label="Ambiente"
          value={environment}
          onChange={setEnvironment}
          options={[
            { label: 'Homologación', value: 'homologacion' },
            { label: 'Producción', value: 'produccion' },
          ]}
        />
        <Subtitle>
          {environment === 'homologacion'
            ? 'Homologación es para probar: las facturas no tienen validez fiscal.'
            : 'Producción emite comprobantes reales con validez fiscal.'}
        </Subtitle>
        <Button variant="primary" full loading={mutation.isPending} onPress={onSubmit}>
          Crear emisor
        </Button>
      </Screen>
    </>
  );
}
