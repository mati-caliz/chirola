import { useMemo, useState, type ReactNode } from "react";
import { FileText } from "lucide-react-native";
import { ActivityIndicator, FlatList, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { voucherTypeName, hasText, type VoucherSummary } from "@chirola/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Amount, Banner, Button, Card, Chip, EmptyState, SearchBar, StatusBadge } from "@/components/ds";
import { useActiveIssuer } from "@/lib/active-issuer";
import { listVouchers } from "@/lib/resources";
import { formatCurrency, formatDate, formatVoucherNumber } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { type StatusKey } from "@/theme/tokens";
import { voucherStatusKey } from "@/lib/voucher-status";
import { PendingVouchersSection } from "@/components/vouchers/PendingVouchersSection";

type VoucherFilter = "todos" | StatusKey;

const filters: { id: VoucherFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "aprobado", label: "Aprobados" },
  { id: "observado", label: "Observados" },
  { id: "rechazado", label: "Rechazados" },
];

const recipientLabel = (voucher: VoucherSummary): string =>
  voucher.recipientName ?? voucher.client?.legalName ?? voucher.client?.docNumber ?? "Consumidor final";

interface VoucherListBodyProps {
  activeIssuerId: string | null;
  vouchersQuery: UseQueryResult<VoucherSummary[]>;
  rows: VoucherSummary[];
}

const VoucherListBody = ({
  activeIssuerId,
  vouchersQuery,
  rows,
}: Readonly<VoucherListBodyProps>): ReactNode => {
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = vouchersQuery;
  const retry = (): void => {
    void refetch();
  };

  if (!hasText(activeIssuerId)) {
    return (
      <EmptyState
        icon={(item) => <FileText {...item} strokeWidth={1.75} />}
        title="Elegí un emisor"
        body="Agregá o seleccioná un emisor para ver sus comprobantes."
      />
    );
  }
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.colors.actionPrimary} size="large" />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={{ padding: theme.spacing.screenPad }}>
        <Banner
          kind="error"
          title="No pudimos cargar tus comprobantes"
          body="Revisá tu conexión y volvé a intentar."
          action={
            <Button variant="secondary" onPress={retry}>
              Reintentar
            </Button>
          }
        />
      </View>
    );
  }
  if (rows.length === 0) {
    const hasVouchers = data !== undefined && data.length > 0;
    return (
      <>
        <View style={{ paddingHorizontal: theme.spacing.screenPad, paddingTop: theme.spacing.stackGap }}>
          <PendingVouchersSection issuerId={activeIssuerId} />
        </View>
        <EmptyState
          icon={(item) => <FileText {...item} strokeWidth={1.75} />}
          title={hasVouchers ? "Sin resultados" : "Todavía no hay comprobantes"}
          body={
            hasVouchers
              ? "Probá con otro filtro o búsqueda."
              : "Cuando emitas una factura, la vas a ver acá con su estado y CAE."
          }
        />
      </>
    );
  }
  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        padding: theme.spacing.screenPad,
        gap: theme.spacing.stackGap,
        paddingBottom: 120,
      }}
      showsVerticalScrollIndicator={false}
      refreshing={isRefetching}
      onRefresh={retry}
      ListHeaderComponent={<PendingVouchersSection issuerId={activeIssuerId} />}
      renderItem={({ item }) => (
        <VoucherRow
          voucher={item}
          onPress={() => {
            router.push(`/(app)/vouchers/${item.id}`);
          }}
        />
      )}
    />
  );
};

const matchesSearch = (voucher: VoucherSummary, query: string): boolean => {
  const number = formatVoucherNumber(voucher.salesPoint.number, voucher.number);
  return number.includes(query) || recipientLabel(voucher).toLowerCase().includes(query);
};

export default function ComprobantesScreen(): ReactNode {
  const theme = useTheme();
  const { activeIssuerId } = useActiveIssuer();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<VoucherFilter>("todos");

  const vouchersQuery = useQuery({
    queryKey: ["vouchers", activeIssuerId],
    queryFn: hasText(activeIssuerId) ? () => listVouchers(activeIssuerId) : skipToken,
  });
  const { data } = vouchersQuery;

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter((voucher) => {
      if (filter !== "todos" && voucherStatusKey(voucher.status) !== filter) return false;
      return query === "" || matchesSearch(voucher, query);
    });
  }, [data, filter, search]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["top"]}>
      <View style={{ paddingHorizontal: theme.spacing.screenPad, paddingTop: 8, gap: 12 }}>
        <Text
          style={{
            fontFamily: theme.font.extrabold,
            fontSize: theme.fontSize.title,
            color: theme.colors.textPrimary,
          }}
        >
          Comprobantes
        </Text>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClear={() => {
            setSearch("");
          }}
          placeholder="Buscar por cliente o número"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filters.map((statusFilter) => (
            <Chip
              key={statusFilter.id}
              label={statusFilter.label}
              selected={filter === statusFilter.id}
              onPress={() => {
                setFilter(statusFilter.id);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <VoucherListBody activeIssuerId={activeIssuerId} vouchersQuery={vouchersQuery} rows={rows} />
    </SafeAreaView>
  );
}

const VoucherRow = ({
  voucher,
  onPress,
}: Readonly<{ voucher: VoucherSummary; onPress: () => void }>): ReactNode => {
  const theme = useTheme();
  const name = voucherTypeName[voucher.voucherType] ?? `Tipo ${voucher.voucherType}`;
  const number = formatVoucherNumber(voucher.salesPoint.number, voucher.number);
  const status = voucherStatusKey(voucher.status);
  const client = recipientLabel(voucher);
  return (
    <Card onPress={onPress}>
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: theme.font.semibold,
              fontSize: theme.fontSize.body,
              color: theme.colors.textPrimary,
            }}
          >
            {client}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: theme.font.monoRegular,
              fontSize: theme.fontSize.caption,
              color: theme.colors.textSecondary,
            }}
          >
            {name} {number}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: theme.font.regular,
              fontSize: theme.fontSize.micro,
              color: theme.colors.textTertiary,
            }}
          >
            {formatDate(voucher.voucherDate)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Amount value={formatCurrency(Number(voucher.totalAmount), voucher.currency)} size="sm" />
          <StatusBadge status={status} size="sm" />
        </View>
      </View>
    </Card>
  );
};
