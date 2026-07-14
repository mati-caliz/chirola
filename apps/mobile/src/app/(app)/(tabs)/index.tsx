import { useState } from 'react';
import { Bell, ChevronDown, Plus } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  Divider,
  EmptyState,
  IconButton,
  ListItem,
  Loading,
  StatusBadge,
} from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';
import { getFiscalAlerts, type Issuer } from '@/lib/resources';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

function certStatus(issuer: Issuer): { kind: 'ok' | 'missing' | 'expiring'; validUntil: string | null } {
  const cert = issuer.certificate;
  if (!cert) return { kind: 'missing', validUntil: null };
  if (cert.validUntil) {
    const days = (new Date(cert.validUntil).getTime() - Date.now()) / 86_400_000;
    if (days < 30) return { kind: 'expiring', validUntil: cert.validUntil };
  }
  return { kind: 'ok', validUntil: cert.validUntil };
}

export default function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { issuers, activeIssuer, activeIssuerId, isLoading, selectIssuer } = useActiveIssuer();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: alerts } = useQuery({
    queryKey: ['fiscal-alerts', activeIssuerId],
    queryFn: () => getFiscalAlerts(activeIssuerId as string),
    enabled: Boolean(activeIssuerId),
  });
  const hasAlerts = Boolean(alerts && (alerts.certificate || alerts.vencimientos.length > 0));

  if (isLoading) return <Loading />;

  if (!activeIssuer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
        <View style={{ padding: theme.spacing.screenPad }}>
          <Wordmark />
        </View>
        <EmptyState
          icon={(p) => <Plus {...p} strokeWidth={1.75} />}
          title="Agregá tu primer emisor"
          body="Un emisor es el CUIT en cuyo nombre vas a facturar. Podés administrar varios."
          action={
            <Button variant="primary" onPress={() => router.push('/(app)/issuers/new')}>
              Agregar emisor
            </Button>
          }
        />
      </SafeAreaView>
    );
  }

  const cert = certStatus(activeIssuer);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.screenPad, gap: theme.spacing.stackGap, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View>
              <IconButton
                label="Novedades"
                icon={(p) => <Bell {...p} strokeWidth={2} />}
                onPress={() => router.push('/(app)/notifications')}
              />
              {hasAlerts ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: theme.colors.actionDanger,
                    borderWidth: 1.5,
                    borderColor: theme.colors.bgApp,
                  }}
                />
              ) : null}
            </View>
            <Pressable
              onPress={() => setPickerOpen(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              height: 36,
              borderRadius: theme.radius.pill,
              backgroundColor: pressed ? theme.colors.bgSunken : theme.colors.surfaceCard,
              borderWidth: 1,
              borderColor: theme.colors.borderSubtle,
            })}
          >
            <Text
              numberOfLines={1}
              style={{ maxWidth: 140, fontFamily: theme.font.semibold, fontSize: theme.fontSize.caption, color: theme.colors.textPrimary }}
            >
              {activeIssuer.legalName}
            </Text>
            <ChevronDown size={16} color={theme.colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {cert.kind === 'missing' ? (
          <Banner
            kind="warning"
            title="Configurá tu certificado"
            body="Necesitás el certificado de ARCA para poder emitir. Se hace una sola vez."
            action={
              <Button variant="secondary" onPress={() => router.push(`/(app)/issuers/${activeIssuer.id}/certificate`)}>
                Configurar ahora
              </Button>
            }
          />
        ) : cert.kind === 'expiring' ? (
          <Banner
            kind="warning"
            title="Tu certificado está por vencer"
            body={cert.validUntil ? `Vence el ${formatDate(cert.validUntil)}. Renovalo para seguir emitiendo.` : undefined}
          />
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.body, color: theme.colors.textPrimary }}>
              {activeIssuer.legalName}
            </Text>
            <StatusBadge
              status={cert.kind === 'ok' ? 'aprobado' : cert.kind === 'expiring' ? 'observado' : 'pendiente'}
              label={cert.kind === 'ok' ? 'Certificado activo' : cert.kind === 'expiring' ? 'Por vencer' : 'Sin certificado'}
              size="sm"
            />
          </View>
          <Text style={{ fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
            CUIT {activeIssuer.cuit}
          </Text>
        </Card>

        <Button
          variant="primary"
          full
          disabled={cert.kind === 'missing'}
          onPress={() => router.push(`/(app)/issuers/${activeIssuer.id}/vouchers/new`)}
        >
          Emitir comprobante
        </Button>
        <Button
          variant="secondary"
          full
          onPress={() => router.push(`/(app)/issuers/${activeIssuer.id}/clients`)}
        >
          Clientes
        </Button>
      </ScrollView>

      <BottomSheet open={pickerOpen} title="Tus emisores" onClose={() => setPickerOpen(false)}>
        {issuers.map((issuer, index) => (
          <View key={issuer.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={issuer.legalName}
              subtitle={`CUIT ${issuer.cuit}`}
              trailing={
                issuer.id === activeIssuerId ? <StatusBadge status="aprobado" label="Activo" size="sm" /> : undefined
              }
              onPress={() => {
                selectIssuer(issuer.id);
                setPickerOpen(false);
              }}
            />
          </View>
        ))}
        <View style={{ height: 12 }} />
        <Button
          variant="secondary"
          full
          onPress={() => {
            setPickerOpen(false);
            router.push('/(app)/issuers/new');
          }}
        >
          Agregar otro emisor
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}

const Wordmark = () => {
  const theme = useTheme();
  return (
    <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.heading, color: theme.colors.textBrand }}>
      Chirola
    </Text>
  );
};
