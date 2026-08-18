import { FileText, ShieldCheck, Store, Users } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Banner, Button, Card, Divider, ListItem, Loading, Screen, StatusBadge } from '@/components/ds';
import { listIssuers, type Issuer } from '@/lib/resources';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

const ivaConditionLabel: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
};

export default function IssuerDetailScreen() {
  const theme = useTheme();
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['issuers'], queryFn: listIssuers });

  const issuer = data?.find((candidate: Issuer) => candidate.id === issuerId);

  if (isLoading) return <Loading />;
  if (!issuer) {
    return (
      <>
        <Stack.Screen options={{ title: 'Emisor' }} />
        <Screen>
          <Banner kind="error" title="No se encontró el emisor" />
        </Screen>
      </>
    );
  }

  const cert = issuer.certificate;
  const hasCertificate = cert != null;
  const rowIcon = (Icon: typeof Users) => <Icon size={20} color={theme.colors.textSecondary} strokeWidth={2} />;

  return (
    <>
      <Stack.Screen options={{ title: issuer.legalName }} />
      <Screen>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.subhead, color: theme.colors.textPrimary }}>
                {issuer.legalName}
              </Text>
              <Text style={{ marginTop: 2, fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
                CUIT {issuer.cuit}
              </Text>
            </View>
            <StatusBadge status="pendiente" label={issuer.environment} size="sm" />
          </View>
          <View style={{ height: 10 }} />
          <Divider />
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
              Condición frente al IVA
            </Text>
            <Text style={{ fontFamily: theme.font.medium, fontSize: theme.fontSize.callout, color: theme.colors.textPrimary }}>
              {ivaConditionLabel[issuer.ivaCondition] ?? issuer.ivaCondition}
            </Text>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.callout, color: theme.colors.textPrimary }}>
              Certificado ARCA
            </Text>
            <StatusBadge
              status={hasCertificate ? 'aprobado' : 'pendiente'}
              label={
                hasCertificate
                  ? cert?.validUntil
                    ? `Vence ${formatDate(cert.validUntil)}`
                    : 'Cargado'
                  : 'Sin certificado'
              }
              size="sm"
            />
          </View>
          <Button
            variant="secondary"
            full
            onPress={() => router.push(`/(app)/issuers/${issuer.id}/certificate`)}
          >
            {hasCertificate ? 'Ver / renovar certificado' : 'Configurar certificado'}
          </Button>
        </Card>

        <Card pad={4}>
          <ListItem
            title="Clientes"
            leading={rowIcon(Users)}
            chevron
            onPress={() => router.push(`/(app)/issuers/${issuer.id}/clients`)}
          />
          <Divider inset={16} />
          <ListItem
            title="Puntos de venta"
            leading={rowIcon(Store)}
            chevron
            onPress={() => router.push(`/(app)/issuers/${issuer.id}/sales-points`)}
          />
          <Divider inset={16} />
          <ListItem
            title="Certificado ARCA"
            leading={rowIcon(ShieldCheck)}
            chevron
            onPress={() => router.push(`/(app)/issuers/${issuer.id}/certificate`)}
          />
        </Card>

        <Button
          variant="primary"
          full
          disabled={!hasCertificate}
          icon={<FileText size={18} color={theme.colors.actionPrimaryText} strokeWidth={2} />}
          onPress={() => router.push(`/(app)/issuers/${issuer.id}/vouchers/new`)}
        >
          Emitir comprobante
        </Button>
        {!hasCertificate ? (
          <Banner kind="warning" title="Configurá el certificado para poder emitir" />
        ) : null}
      </Screen>
    </>
  );
}
