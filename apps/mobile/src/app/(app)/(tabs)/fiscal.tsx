import { BarChart3, CalendarClock } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Amount, Banner, Button, Card, Divider, EmptyState, StatusBadge } from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';
import { getIvaPosition, getVencimientos, type VencimientoStatus } from '@/lib/resources';
import { formatCurrency, formatDate } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';
import { type StatusKey } from '@/theme/tokens';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(now);

const vencimientoStatus: Record<VencimientoStatus, { key: StatusKey; label: string }> = {
  OVERDUE: { key: 'rechazado', label: 'Vencido' },
  DUE_SOON: { key: 'observado', label: 'Pronto' },
  UPCOMING: { key: 'pendiente', label: 'Próximo' },
};

export default function FiscalScreen() {
  const theme = useTheme();
  const { activeIssuerId } = useActiveIssuer();

  const position = useQuery({
    queryKey: ['iva-position', activeIssuerId, currentYear, currentMonth],
    queryFn: () => getIvaPosition(activeIssuerId as string, currentYear, currentMonth),
    enabled: Boolean(activeIssuerId),
  });

  const vencimientos = useQuery({
    queryKey: ['vencimientos', activeIssuerId],
    queryFn: () => getVencimientos(activeIssuerId as string),
    enabled: Boolean(activeIssuerId),
  });

  if (!activeIssuerId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
        <EmptyState
          icon={(p) => <BarChart3 {...p} strokeWidth={1.75} />}
          title="Elegí un emisor"
          body="Agregá o seleccioná un emisor para ver su posición fiscal."
        />
      </SafeAreaView>
    );
  }

  const balance = position.data?.balance ?? 0;
  const payable = balance >= 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.screenPad, gap: theme.spacing.stackGap, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.title, color: theme.colors.textPrimary }}>
          Fiscal
        </Text>

        {position.isLoading ? (
          <Card>
            <ActivityIndicator color={theme.colors.actionPrimary} />
          </Card>
        ) : position.isError ? (
          <Banner
            kind="error"
            title="No pudimos calcular tu IVA"
            body="Revisá tu conexión y volvé a intentar."
            action={
              <Button variant="secondary" onPress={() => position.refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : position.data ? (
          <Card>
            <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary }}>
              Posición de IVA · {monthLabel}
            </Text>
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Amount value={formatCurrency(Math.abs(balance))} size="xl" />
              <View style={{ marginTop: 6 }}>
                <StatusBadge status={payable ? 'observado' : 'aprobado'} label={payable ? 'A pagar' : 'A favor'} size="sm" />
              </View>
            </View>
            <Divider />
            <View style={{ height: 8 }} />
            <PositionRow label="IVA débito (ventas)" value={formatCurrency(position.data.totalDebit)} theme={theme} />
            <PositionRow label="IVA crédito (compras)" value={formatCurrency(position.data.totalCredit)} theme={theme} />
          </Card>
        ) : null}

        <View style={{ marginTop: 4 }}>
          <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary, marginBottom: 8 }}>
            Próximos vencimientos
          </Text>
          {vencimientos.isLoading ? (
            <Card>
              <ActivityIndicator color={theme.colors.actionPrimary} />
            </Card>
          ) : vencimientos.data && vencimientos.data.length > 0 ? (
            <Card pad={4}>
              {vencimientos.data.map((item, index) => {
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
          ) : (
            <Card>
              <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
                No hay vencimientos en los próximos 90 días.
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const PositionRow = ({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
    <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
      {label}
    </Text>
    <Text style={{ fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.callout, color: theme.colors.textPrimary }}>
      {value}
    </Text>
  </View>
);
