import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react-native';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { voucherTypeName } from '@chirola/shared';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Amount, Banner, Button, Card, Chip, EmptyState, SearchBar, StatusBadge } from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';
import { listVouchers, type VoucherSummary } from '@/lib/resources';
import { formatCurrency, formatDate, formatVoucherNumber } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';
import { type StatusKey } from '@/theme/tokens';

const filters: { id: 'todos' | StatusKey; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'aprobado', label: 'Aprobados' },
  { id: 'observado', label: 'Observados' },
  { id: 'rechazado', label: 'Rechazados' },
];

function toStatusKey(status: string, hasCae: boolean): StatusKey {
  if (hasCae) return 'aprobado';
  const value = status.toLowerCase();
  if (value.includes('rechaz') || value.includes('reject')) return 'rechazado';
  if (value.includes('observ')) return 'observado';
  return 'pendiente';
}

export default function ComprobantesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { activeIssuerId } = useActiveIssuer();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | StatusKey>('todos');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['vouchers', activeIssuerId],
    queryFn: () => listVouchers(activeIssuerId as string),
    enabled: Boolean(activeIssuerId),
  });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter((voucher) => {
      const status = toStatusKey(voucher.status, Boolean(voucher.cae));
      if (filter !== 'todos' && status !== filter) return false;
      if (!query) return true;
      const number = formatVoucherNumber(voucher.salesPoint.number, voucher.number);
      const client = voucher.client?.legalName ?? voucher.client?.docNumber ?? '';
      return number.includes(query) || client.toLowerCase().includes(query);
    });
  }, [data, filter, search]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
      <View style={{ paddingHorizontal: theme.spacing.screenPad, paddingTop: 8, gap: 12 }}>
        <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.title, color: theme.colors.textPrimary }}>
          Comprobantes
        </Text>
        <SearchBar value={search} onChangeText={setSearch} onClear={() => setSearch('')} placeholder="Buscar por cliente o número" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filters.map((f) => (
            <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>
      </View>

      {!activeIssuerId ? (
        <EmptyState
          icon={(p) => <FileText {...p} strokeWidth={1.75} />}
          title="Elegí un emisor"
          body="Agregá o seleccioná un emisor para ver sus comprobantes."
        />
      ) : isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.actionPrimary} size="large" />
        </View>
      ) : isError ? (
        <View style={{ padding: theme.spacing.screenPad }}>
          <Banner
            kind="error"
            title="No pudimos cargar tus comprobantes"
            body="Revisá tu conexión y volvé a intentar."
            action={
              <Button variant="secondary" onPress={() => refetch()}>
                Reintentar
              </Button>
            }
          />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={(p) => <FileText {...p} strokeWidth={1.75} />}
          title={data && data.length > 0 ? 'Sin resultados' : 'Todavía no hay comprobantes'}
          body={
            data && data.length > 0
              ? 'Probá con otro filtro o búsqueda.'
              : 'Cuando emitas una factura, la vas a ver acá con su estado y CAE.'
          }
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: theme.spacing.screenPad, gap: theme.spacing.stackGap, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <VoucherRow voucher={item} onPress={() => router.push(`/(app)/vouchers/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const VoucherRow = ({ voucher, onPress }: { voucher: VoucherSummary; onPress: () => void }) => {
  const theme = useTheme();
  const name = voucherTypeName[voucher.voucherType] ?? `Tipo ${voucher.voucherType}`;
  const number = formatVoucherNumber(voucher.salesPoint.number, voucher.number);
  const status = toStatusKey(voucher.status, Boolean(voucher.cae));
  const client = voucher.client?.legalName ?? voucher.client?.docNumber ?? 'Consumidor final';
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.body, color: theme.colors.textPrimary }}>
            {client}
          </Text>
          <Text style={{ marginTop: 2, fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
            {name} {number}
          </Text>
          <Text style={{ marginTop: 2, fontFamily: theme.font.regular, fontSize: theme.fontSize.micro, color: theme.colors.textTertiary }}>
            {formatDate(voucher.voucherDate)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Amount value={formatCurrency(Number(voucher.totalAmount))} size="sm" />
          <StatusBadge status={status} size="sm" />
        </View>
      </View>
    </Card>
  );
};
