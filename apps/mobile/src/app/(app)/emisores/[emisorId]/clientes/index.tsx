import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { nombreTipoDocumento } from '@chirola/shared';
import {
  BodyText,
  Button,
  Card,
  Centered,
  Loading,
  Screen,
  Subtitle,
} from '@/components/ui';
import { listarClientes, type Cliente } from '@/lib/resources';

export default function ClientesScreen() {
  const { emisorId } = useLocalSearchParams<{ emisorId: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['clientes', emisorId],
    queryFn: () => listarClientes(emisorId),
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Clientes' }} />
      <Screen>
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <Centered>
            <BodyText>{error instanceof Error ? error.message : 'Error al cargar.'}</BodyText>
            <Button title="Reintentar" variant="secondary" onPress={() => refetch()} />
          </Centered>
        ) : data && data.length > 0 ? (
          data.map((c: Cliente) => (
            <Card key={c.id}>
              <BodyText>{c.razonSocial ?? 'Sin razón social'}</BodyText>
              <Subtitle>
                {nombreTipoDocumento[c.tipoDoc] ?? `Doc ${c.tipoDoc}`} {c.numeroDoc}
              </Subtitle>
              {c.email ? <Subtitle>{c.email}</Subtitle> : null}
            </Card>
          ))
        ) : (
          <Centered>
            <Subtitle>Todavía no cargaste clientes.</Subtitle>
          </Centered>
        )}
        <Button
          title="+ Nuevo cliente"
          onPress={() => router.push(`/(app)/emisores/${emisorId}/clientes/nuevo`)}
        />
      </Screen>
    </>
  );
}
