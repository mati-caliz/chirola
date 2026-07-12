import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createIssuerSchema, type CreateIssuer } from '@chirola/shared';
import {
  Button,
  ErrorText,
  OptionGroup,
  Screen,
  Subtitle,
  TextField,
} from '@/components/ui';
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

  function onSubmit() {
    setError(null);
    const parsed = createIssuerSchema.safeParse({ cuit, legalName, ivaCondition, environment });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }
    mutation.mutate(parsed.data);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo emisor' }} />
      <Screen>
        <Subtitle>Cargá el CUIT que va a facturar.</Subtitle>
        <TextField
          label="CUIT (11 dígitos)"
          value={cuit}
          onChangeText={setCuit}
          keyboardType="number-pad"
          maxLength={11}
          placeholder="20123456789"
        />
        <TextField
          label="Razón social"
          value={legalName}
          onChangeText={setLegalName}
          placeholder="Juan Pérez"
        />
        <OptionGroup<IvaCondition>
          label="Condición frente al IVA"
          value={ivaCondition}
          onChange={setIvaCondition}
          options={[
            { label: 'Resp. Inscripto', value: 'RESPONSABLE_INSCRIPTO' },
            { label: 'Monotributo', value: 'MONOTRIBUTO' },
            { label: 'Exento', value: 'EXENTO' },
          ]}
        />
        <OptionGroup<Environment>
          label="Ambiente"
          value={environment}
          onChange={setEnvironment}
          options={[
            { label: 'Homologación', value: 'homologacion' },
            { label: 'Producción', value: 'produccion' },
          ]}
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Crear emisor" onPress={onSubmit} loading={mutation.isPending} />
      </Screen>
    </>
  );
}
