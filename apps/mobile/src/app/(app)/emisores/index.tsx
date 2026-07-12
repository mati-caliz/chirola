import { Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  BodyText,
  brandColor,
  Button,
  Card,
  Centered,
  Loading,
  Screen,
  Subtitle,
  Title,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { listarEmisores, type Emisor } from '@/lib/resources';
import { formatFecha } from '@/lib/format';

export default function EmisoresScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['emisores'],
    queryFn: listarEmisores,
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Emisores',
          headerRight: () => (
            <Pressable onPress={logout} hitSlop={8}>
              <Text style={{ color: brandColor, fontWeight: '600' }}>Salir</Text>
            </Pressable>
          ),
        }}
      />
      <Screen>
        <View style={{ gap: 4 }}>
          <Title>Tus emisores</Title>
          <Subtitle>Los CUIT en cuyo nombre facturás.</Subtitle>
        </View>

        {isLoading ? (
          <Loading />
        ) : isError ? (
          <Centered>
            <BodyText>{error instanceof Error ? error.message : 'Error al cargar.'}</BodyText>
            <Button title="Reintentar" variant="secondary" onPress={() => refetch()} />
          </Centered>
        ) : data && data.length > 0 ? (
          data.map((e) => (
            <EmisorCard
              key={e.id}
              emisor={e}
              onPress={() => router.push(`/(app)/emisores/${e.id}`)}
            />
          ))
        ) : (
          <Centered>
            <Subtitle>Todavía no cargaste ningún emisor.</Subtitle>
          </Centered>
        )}

        <Button title="+ Nuevo emisor" onPress={() => router.push('/(app)/emisores/nuevo')} />
      </Screen>
    </>
  );
}

function EmisorCard({ emisor, onPress }: { emisor: Emisor; onPress: () => void }) {
  const cert = emisor.certificado;
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BodyText>{emisor.razonSocial}</BodyText>
        <Badge text={emisor.ambiente} tone="neutral" />
      </View>
      <Subtitle>CUIT {emisor.cuit}</Subtitle>
      {cert ? (
        <Badge
          text={cert.validoHasta ? `Cert. vence ${formatFecha(cert.validoHasta)}` : 'Certificado cargado'}
          tone="ok"
        />
      ) : (
        <Badge text="Sin certificado" tone="warn" />
      )}
    </Card>
  );
}
