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
import { listIssuers, type Issuer } from '@/lib/resources';
import { formatDate } from '@/lib/format';

export default function IssuersScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['issuers'],
    queryFn: listIssuers,
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
          data.map((issuer) => (
            <IssuerCard
              key={issuer.id}
              issuer={issuer}
              onPress={() => router.push(`/(app)/issuers/${issuer.id}`)}
            />
          ))
        ) : (
          <Centered>
            <Subtitle>Todavía no cargaste ningún emisor.</Subtitle>
          </Centered>
        )}

        <Button title="+ Nuevo emisor" onPress={() => router.push('/(app)/issuers/new')} />
      </Screen>
    </>
  );
}

function IssuerCard({ issuer, onPress }: { issuer: Issuer; onPress: () => void }) {
  const certificate = issuer.certificate;
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BodyText>{issuer.legalName}</BodyText>
        <Badge text={issuer.environment} tone="neutral" />
      </View>
      <Subtitle>CUIT {issuer.cuit}</Subtitle>
      {certificate ? (
        <Badge
          text={certificate.validUntil ? `Cert. vence ${formatDate(certificate.validUntil)}` : 'Certificado cargado'}
          tone="ok"
        />
      ) : (
        <Badge text="Sin certificado" tone="warn" />
      )}
    </Card>
  );
}
