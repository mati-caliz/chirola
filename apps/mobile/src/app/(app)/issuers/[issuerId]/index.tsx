import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  BodyText,
  Button,
  Card,
  Centered,
  Label,
  Loading,
  Screen,
  Subtitle,
  Title,
} from '@/components/ui';
import { listIssuers, type Issuer } from '@/lib/resources';
import { formatDate } from '@/lib/format';

const ivaConditionLabel: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
};

export default function IssuerDetailScreen() {
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['issuers'],
    queryFn: listIssuers,
  });

  const issuer = data?.find((candidate: Issuer) => candidate.id === issuerId);

  if (isLoading) return <Loading />;
  if (!issuer) {
    return (
      <>
        <Stack.Screen options={{ title: 'Emisor' }} />
        <Centered>
          <BodyText>No se encontró el emisor.</BodyText>
        </Centered>
      </>
    );
  }

  const certificate = issuer.certificate;
  const hasCertificate = certificate != null;

  return (
    <>
      <Stack.Screen options={{ title: issuer.legalName }} />
      <Screen>
        <View style={{ gap: 4 }}>
          <Title>{issuer.legalName}</Title>
          <Subtitle>CUIT {issuer.cuit}</Subtitle>
        </View>

        <Card>
          <Label>Condición IVA</Label>
          <BodyText>{ivaConditionLabel[issuer.ivaCondition] ?? issuer.ivaCondition}</BodyText>
          <View style={{ height: 8 }} />
          <Label>Ambiente</Label>
          <Badge text={issuer.environment} tone="neutral" />
        </Card>

        <Card>
          <Label>Certificado ARCA</Label>
          {hasCertificate ? (
            <Badge
              text={certificate?.validUntil ? `Vence ${formatDate(certificate.validUntil)}` : 'Cargado'}
              tone="ok"
            />
          ) : (
            <Badge text="Sin certificado" tone="warn" />
          )}
          <Button
            title={hasCertificate ? 'Ver / renovar certificado' : 'Configurar certificado'}
            variant="secondary"
            onPress={() => router.push(`/(app)/issuers/${issuer.id}/certificate`)}
          />
        </Card>

        <Button
          title="Clientes"
          variant="secondary"
          onPress={() => router.push(`/(app)/issuers/${issuer.id}/clients`)}
        />
        <Button
          title="Emitir comprobante"
          disabled={!hasCertificate}
          onPress={() => router.push(`/(app)/issuers/${issuer.id}/vouchers/new`)}
        />
        {!hasCertificate ? (
          <Subtitle>Configurá el certificado para poder emitir.</Subtitle>
        ) : null}
      </Screen>
    </>
  );
}
