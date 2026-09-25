import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PendingVoucherStatus, voucherTypeName, type PendingVoucherSummary } from "@chirola/shared";
import { Amount, Banner, Button, Card, StatusBadge } from "@/components/ds";
import { discardPendingVoucher, listPendingVouchers, retryPendingVoucher } from "@/lib/resources";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";

const PENDING_REFRESH_MS = 30_000;

export const pendingVouchersQueryKey = (issuerId: string) => ["pending-vouchers", issuerId];

export const PendingVouchersSection = ({ issuerId }: { issuerId: string }) => {
  const theme = useTheme();
  const { data } = useQuery({
    queryKey: pendingVouchersQueryKey(issuerId),
    queryFn: () => listPendingVouchers(issuerId),
    refetchInterval: PENDING_REFRESH_MS,
  });

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: theme.spacing.stackGap, marginBottom: theme.spacing.stackGap }}>
      <Text
        style={{
          fontFamily: theme.font.semibold,
          fontSize: theme.fontSize.micro,
          letterSpacing: 0.66,
          textTransform: "uppercase",
          color: theme.colors.textTertiary,
        }}
      >
        Sin CAE todavía
      </Text>
      {data.map((pending) => (
        <PendingVoucherCard key={pending.id} issuerId={issuerId} pending={pending} />
      ))}
    </View>
  );
};

const PendingVoucherCard = ({ issuerId, pending }: { issuerId: string; pending: PendingVoucherSummary }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const failed = pending.status === PendingVoucherStatus.FAILED;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: pendingVouchersQueryKey(issuerId) });
    void queryClient.invalidateQueries({ queryKey: ["vouchers", issuerId] });
  };
  const retry = useMutation({
    mutationFn: () => retryPendingVoucher(issuerId, pending.id),
    onSuccess: refresh,
  });
  const discard = useMutation({
    mutationFn: () => discardPendingVoucher(issuerId, pending.id),
    onSuccess: refresh,
  });
  const actionError = retry.error ?? discard.error;

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: theme.font.semibold,
              fontSize: theme.fontSize.body,
              color: theme.colors.textPrimary,
            }}
          >
            {pending.recipientName ?? "Consumidor final"}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: theme.font.regular,
              fontSize: theme.fontSize.caption,
              color: theme.colors.textSecondary,
            }}
          >
            {voucherTypeName[pending.voucherType] ?? `Tipo ${pending.voucherType}`} ·{" "}
            {formatDate(pending.createdAt)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Amount value={formatCurrency(pending.totalAmount, pending.currency)} size="sm" />
          <StatusBadge
            status={failed ? "rechazado" : "pendiente"}
            label={failed ? "Falló" : "En cola"}
            size="sm"
          />
        </View>
      </View>
      <Text
        style={{
          marginTop: 10,
          fontFamily: theme.font.regular,
          fontSize: theme.fontSize.caption,
          color: theme.colors.textSecondary,
        }}
      >
        {failed
          ? `ARCA no lo autorizó: ${pending.lastError ?? "sin detalle"}`
          : "ARCA no respondió al emitir. Se reintenta solo y te avisamos cuando tenga CAE."}
      </Text>
      {actionError ? (
        <View style={{ marginTop: 10 }}>
          <Banner kind="error" title="No se pudo completar la acción" body={actionError.message} />
        </View>
      ) : null}
      {failed ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" full loading={retry.isPending} onPress={() => retry.mutate()}>
              Reintentar
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" full loading={discard.isPending} onPress={() => discard.mutate()}>
              Descartar
            </Button>
          </View>
        </View>
      ) : null}
    </Card>
  );
};
