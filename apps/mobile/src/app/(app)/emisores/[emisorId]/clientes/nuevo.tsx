import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { crearClienteSchema, TipoDocumento } from '@chirola/shared';
import {
  Button,
  ErrorText,
  OptionGroup,
  Screen,
  Subtitle,
  TextField,
} from '@/components/ui';
import { crearCliente } from '@/lib/resources';

export default function NuevoClienteScreen() {
  const { emisorId } = useLocalSearchParams<{ emisorId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [tipoDoc, setTipoDoc] = useState<number>(TipoDocumento.CUIT);
  const [numeroDoc, setNumeroDoc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: ReturnType<typeof crearClienteSchema.parse>) =>
      crearCliente(emisorId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes', emisorId] });
      router.back();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear el cliente.'),
  });

  function onSubmit() {
    setError(null);
    const parsed = crearClienteSchema.safeParse({
      tipoDoc,
      numeroDoc,
      razonSocial: razonSocial.trim() || undefined,
      email: email.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
      return;
    }
    mutation.mutate(parsed.data);
  }

  const esCuitCuil = tipoDoc === TipoDocumento.CUIT || tipoDoc === TipoDocumento.CUIL;

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo cliente' }} />
      <Screen>
        <Subtitle>Los receptores que después vas a poder elegir al facturar.</Subtitle>
        <OptionGroup<number>
          label="Tipo de documento"
          value={tipoDoc}
          onChange={setTipoDoc}
          options={[
            { label: 'CUIT', value: TipoDocumento.CUIT },
            { label: 'CUIL', value: TipoDocumento.CUIL },
            { label: 'DNI', value: TipoDocumento.DNI },
            { label: 'Cons. Final', value: TipoDocumento.CONSUMIDOR_FINAL },
          ]}
        />
        <TextField
          label={esCuitCuil ? 'Número (11 dígitos)' : 'Número de documento'}
          value={numeroDoc}
          onChangeText={setNumeroDoc}
          keyboardType="number-pad"
          maxLength={esCuitCuil ? 11 : 15}
          placeholder={esCuitCuil ? '20123456789' : '12345678'}
        />
        <TextField
          label="Razón social / Nombre"
          value={razonSocial}
          onChangeText={setRazonSocial}
          placeholder="Opcional"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Opcional"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Crear cliente" onPress={onSubmit} loading={mutation.isPending} />
      </Screen>
    </>
  );
}
