import { BellOff, CalendarClock, ShieldAlert } from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Banner, Card, Divider, EmptyState, Screen, StatusBadge } from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';
import { getFiscalAlerts, type VencimientoStatus } from '@/lib/resources';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';
import { type StatusKey } from '@/theme/tokens';

const vencimientoStatus: Record<VencimientoStatus, { key: StatusKey; label: string }> = {
  OVERDUE: { key: 'rechazado', label: 'Vencido' },
  DUE_SOON: { key: 'observado', label: 'Pronto' },
  UPCOMING: { key: 'pendiente', label: 'Próximo' },
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { activeIssuer, activeIssuerId } = useActiveIssuer();

  const { data, isLoading } = useQuery({
    queryKey: ['fiscal-alerts', activeIssuerId],
    queryFn: () => getFiscalAlerts(activeIssuerId as string),
    enabled: Boolean(activeIssuerId),
  });

  const hasAlerts = Boolean(data && (data.certificate || data.vencimientos.length > 0));

  return (
    <>
      <Stack.Screen options={{ title: 'Novedades' }} />
      <Screen>
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.actionPrimary} size="large" />
          </View>
        ) : !hasAlerts ? (
          <EmptyState
            icon={(p) => <BellOff {...p} strokeWidth={1.75} />}
            title="Estás al día"
            body="No hay vencimientos próximos ni avisos de tu certificado."
          />
        ) : (
          <>
            {data?.certificate && activeIssuer ? (
              <Banner
                kind={data.certificate.daysToExpiry <= 0 ? 'error' : 'warning'}
                title={
                  data.certificate.daysToExpiry <= 0
                    ? 'Tu certificado venció'
                    : `Tu certificado vence en ${data.certificate.daysToExpiry} días`
                }
                body={`Vence el ${formatDate(data.certificate.validUntil)}. Renovalo para seguir emitiendo.`}
              />
            ) : null}

            {data && data.vencimientos.length > 0 ? (
              <Card pad={4}>
                {data.vencimientos.map((item, index) => {
                  const badge = vencimientoStatus[item.status];
                  return (
                    <View key={`${item.type}-${item.dueDate}`}>
                      {index > 0 ? <Divider inset={16} /> : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                        <CalendarClock size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: theme.font.medium, fontSize: theme.fontSize.callout, color: theme.colors.textPrimary }}>
                            {item.label}
                          </Text>
                          <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
                            Vence {formatDate(item.dueDate)}
                          </Text>
                        </View>
                        <StatusBadge status={badge.key} label={badge.label} size="sm" />
                      </View>
                    </View>
                  );
                })}
              </Card>
            ) : null}

            {data?.certificate && activeIssuer ? (
              <Card onPress={() => router.push(`/(app)/issuers/${activeIssuer.id}/certificate`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ShieldAlert size={20} color={theme.colors.textBrand} strokeWidth={2} />
                  <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.callout, color: theme.colors.textBrand }}>
                    Renovar certificado
                  </Text>
                </View>
              </Card>
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}
