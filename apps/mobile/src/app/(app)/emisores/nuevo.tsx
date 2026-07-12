import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { crearEmisorSchema, type CrearEmisor } from '@chirola/shared';
import {
  Button,
  ErrorText,
  OptionGroup,
  Screen,
  Subtitle,
  TextField,
} from '@/components/ui';
import { crearEmisor } from '@/lib/resources';

type CondicionIva = CrearEmisor['condicionIva'];
type Ambiente = CrearEmisor['ambiente'];

export default function NuevoEmisorScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [cuit, setCuit] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [condicionIva, setCondicionIva] = useState<CondicionIva>('RESPONSABLE_INSCRIPTO');
  const [ambiente, setAmbiente] = useState<Ambiente>('homologacion');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: crearEmisor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emisores'] });
      router.back();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear el emisor.'),
  });

  function onSubmit() {
    setError(null);
    const parsed = crearEmisorSchema.safeParse({ cuit, razonSocial, condicionIva, ambiente });
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
          value={razonSocial}
          onChangeText={setRazonSocial}
          placeholder="Juan Pérez"
        />
        <OptionGroup<CondicionIva>
          label="Condición frente al IVA"
          value={condicionIva}
          onChange={setCondicionIva}
          options={[
            { label: 'Resp. Inscripto', value: 'RESPONSABLE_INSCRIPTO' },
            { label: 'Monotributo', value: 'MONOTRIBUTO' },
            { label: 'Exento', value: 'EXENTO' },
          ]}
        />
        <OptionGroup<Ambiente>
          label="Ambiente"
          value={ambiente}
          onChange={setAmbiente}
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
