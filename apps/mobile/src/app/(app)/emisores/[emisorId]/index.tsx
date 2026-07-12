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
import { listarEmisores, type Emisor } from '@/lib/resources';
import { formatFecha } from '@/lib/format';

const condicionLabel: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
};

export default function EmisorDetalleScreen() {
  const { emisorId } = useLocalSearchParams<{ emisorId: string }>();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['emisores'],
    queryFn: listarEmisores,
  });

  const emisor = data?.find((e: Emisor) => e.id === emisorId);

  if (isLoading) return <Loading />;
  if (!emisor) {
    return (
      <>
        <Stack.Screen options={{ title: 'Emisor' }} />
        <Centered>
          <BodyText>No se encontró el emisor.</BodyText>
        </Centered>
      </>
    );
  }

  const cert = emisor.certificado;
  const tieneCert = cert != null;

  return (
    <>
      <Stack.Screen options={{ title: emisor.razonSocial }} />
      <Screen>
        <View style={{ gap: 4 }}>
          <Title>{emisor.razonSocial}</Title>
          <Subtitle>CUIT {emisor.cuit}</Subtitle>
        </View>

        <Card>
          <Label>Condición IVA</Label>
          <BodyText>{condicionLabel[emisor.condicionIva] ?? emisor.condicionIva}</BodyText>
          <View style={{ height: 8 }} />
          <Label>Ambiente</Label>
          <Badge text={emisor.ambiente} tone="neutral" />
        </Card>

        <Card>
          <Label>Certificado ARCA</Label>
          {tieneCert ? (
            <Badge
              text={cert?.validoHasta ? `Vence ${formatFecha(cert.validoHasta)}` : 'Cargado'}
              tone="ok"
            />
          ) : (
            <Badge text="Sin certificado" tone="warn" />
          )}
          <Button
            title={tieneCert ? 'Ver / renovar certificado' : 'Configurar certificado'}
            variant="secondary"
            onPress={() => router.push(`/(app)/emisores/${emisor.id}/certificado`)}
          />
        </Card>

        <Button
          title="Clientes"
          variant="secondary"
          onPress={() => router.push(`/(app)/emisores/${emisor.id}/clientes`)}
        />
        <Button
          title="Emitir comprobante"
          disabled={!tieneCert}
          onPress={() => router.push(`/(app)/emisores/${emisor.id}/comprobantes/nuevo`)}
        />
        {!tieneCert ? (
          <Subtitle>Configurá el certificado para poder emitir.</Subtitle>
        ) : null}
      </Screen>
    </>
  );
}
