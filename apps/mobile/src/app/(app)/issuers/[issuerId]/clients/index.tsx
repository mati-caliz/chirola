import { UserPlus, Users } from "lucide-react-native";
import { Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { documentTypeName } from "@chirola/shared";
import { Banner, Button, Card, Divider, EmptyState, ListItem, Loading, Screen } from "@/components/ds";
import { listClients } from "@/lib/resources";
import type { Client } from "@chirola/shared";
import { useTheme } from "@/hooks/use-theme";
import type { ReactNode } from "react";

const Avatar = ({ name }: Readonly<{ name: string }>): ReactNode => {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.surfaceBrandSubtle,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: theme.font.bold,
          fontSize: theme.fontSize.callout,
          color: theme.colors.textBrand,
        }}
      >
        {initial}
      </Text>
    </View>
  );
};

const documentLabel = (client: Client): string => {
  const typeName = documentTypeName[client.docType] ?? `Doc ${client.docType}`;
  return `${typeName} ${client.docNumber}`;
};

const ClientList = ({ clients, onNew }: Readonly<{ clients: Client[]; onNew: () => void }>): ReactNode => {
  const theme = useTheme();
  return (
    <>
      <Card pad={4}>
        {clients.map((client, index) => {
          const name = client.legalName ?? client.docNumber;
          return (
            <View key={client.id}>
              {index > 0 ? <Divider inset={68} /> : null}
              <ListItem
                title={name}
                subtitle={documentLabel(client)}
                leading={<Avatar name={name} />}
                chevron
              />
            </View>
          );
        })}
      </Card>
      <Button
        variant="secondary"
        full
        icon={<UserPlus size={18} color={theme.colors.actionSecondaryText} strokeWidth={2} />}
        onPress={onNew}
      >
        Nuevo cliente
      </Button>
    </>
  );
};

const ClientsContent = ({
  issuerId,
  onNew,
}: Readonly<{ issuerId: string; onNew: () => void }>): ReactNode => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["clients", issuerId],
    queryFn: () => listClients(issuerId),
  });

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <Banner
        kind="error"
        title="No pudimos cargar tus clientes"
        body="Revisá tu conexión y volvé a intentar."
        action={
          <Button
            variant="secondary"
            onPress={() => {
              void refetch();
            }}
          >
            Reintentar
          </Button>
        }
      />
    );
  }
  if (data && data.length > 0) return <ClientList clients={data} onNew={onNew} />;
  return (
    <EmptyState
      icon={(iconProps) => <Users {...iconProps} strokeWidth={1.75} />}
      title="Todavía no cargaste clientes"
      body="Los clientes son los receptores que después vas a poder elegir al facturar."
      action={
        <Button variant="primary" onPress={onNew}>
          Agregar el primero
        </Button>
      }
    />
  );
};

export default function ClientsScreen(): ReactNode {
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();

  const goNew = (): void => {
    router.push(`/(app)/issuers/${issuerId}/clients/new`);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Clientes" }} />
      <Screen>
        <ClientsContent issuerId={issuerId} onNew={goNew} />
      </Screen>
    </>
  );
}
