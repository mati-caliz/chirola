import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { documentTypeName } from '@chirola/shared';
import {
  BodyText,
  Button,
  Card,
  Centered,
  Loading,
  Screen,
  Subtitle,
} from '@/components/ui';
import { listClients, type Client } from '@/lib/resources';

export default function ClientsScreen() {
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['clients', issuerId],
    queryFn: () => listClients(issuerId),
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
          data.map((client: Client) => (
            <Card key={client.id}>
              <BodyText>{client.legalName ?? 'Sin razón social'}</BodyText>
              <Subtitle>
                {documentTypeName[client.docType] ?? `Doc ${client.docType}`} {client.docNumber}
              </Subtitle>
              {client.email ? <Subtitle>{client.email}</Subtitle> : null}
            </Card>
          ))
        ) : (
          <Centered>
            <Subtitle>Todavía no cargaste clientes.</Subtitle>
          </Centered>
        )}
        <Button
          title="+ Nuevo cliente"
          onPress={() => router.push(`/(app)/issuers/${issuerId}/clients/new`)}
        />
      </Screen>
    </>
  );
}
