import { UserPlus, Users } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { documentTypeName } from '@chirola/shared';
import { Banner, Button, Card, Divider, EmptyState, ListItem, Loading, Screen } from '@/components/ds';
import { listClients, type Client } from '@/lib/resources';
import { useTheme } from '@/hooks/use-theme';

const Avatar = ({ name }: { name: string }) => {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceBrandSubtle, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.callout, color: theme.colors.textBrand }}>
        {initial}
      </Text>
    </View>
  );
};

export default function ClientsScreen() {
  const theme = useTheme();
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clients', issuerId],
    queryFn: () => listClients(issuerId),
  });

  const goNew = () => router.push(`/(app)/issuers/${issuerId}/clients/new`);

  return (
    <>
      <Stack.Screen options={{ title: 'Clientes' }} />
      <Screen>
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <Banner
            kind="error"
            title="No pudimos cargar tus clientes"
            body="Revisá tu conexión y volvé a intentar."
            action={
              <Button variant="secondary" onPress={() => refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : data && data.length > 0 ? (
          <>
            <Card pad={4}>
              {data.map((client: Client, index) => {
                const name = client.legalName ?? client.docNumber;
                return (
                  <View key={client.id}>
                    {index > 0 ? <Divider inset={68} /> : null}
                    <ListItem
                      title={name}
                      subtitle={`${documentTypeName[client.docType] ?? `Doc ${client.docType}`} ${client.docNumber}`}
                      leading={<Avatar name={name} />}
                      chevron
                    />
                  </View>
                );
              })}
            </Card>
            <Button variant="secondary" full icon={<UserPlus size={18} color={theme.colors.actionSecondaryText} strokeWidth={2} />} onPress={goNew}>
              Nuevo cliente
            </Button>
          </>
        ) : (
          <EmptyState
            icon={(p) => <Users {...p} strokeWidth={1.75} />}
            title="Todavía no cargaste clientes"
            body="Los clientes son los receptores que después vas a poder elegir al facturar."
            action={
              <Button variant="primary" onPress={goNew}>
                Agregar el primero
              </Button>
            }
          />
        )}
      </Screen>
    </>
  );
}
