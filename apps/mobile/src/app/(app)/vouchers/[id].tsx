import { ScrollView, Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { isAuthorizedStatus, hasText } from "@chirola/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Loading } from "@/components/ds";
import { apiFetchBase64 } from "@/lib/api";
import { getVoucher } from "@/lib/resources";
import type { VoucherDetail } from "@chirola/shared";
import { formatCurrency } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { voucherStatusKey } from "@/lib/voucher-status";
import { VoucherActions } from "@/components/vouchers/VoucherActions";
import { VoucherHeaderCard } from "@/screens/voucher-detail/VoucherHeaderCard";
import {
  RecipientCard,
  VoucherItemsCard,
  VoucherStatusBanner,
} from "@/screens/voucher-detail/VoucherDetailSections";
import { voucherRecipient, voucherTitle } from "@/screens/voucher-detail/voucher-view-model";
import type { ReactNode } from "react";

const VoucherLoadError = (): ReactNode => {
  const theme = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Comprobante" }} />
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.bgApp,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: theme.font.regular, color: theme.colors.textPrimary }}>
          No se pudo cargar el comprobante.
        </Text>
      </SafeAreaView>
    </>
  );
};

const VoucherDetailContent = ({
  voucher,
  authorized,
  qrBase64,
}: Readonly<{ voucher: VoucherDetail; authorized: boolean; qrBase64: string | undefined }>): ReactNode => {
  const theme = useTheme();
  const status = voucherStatusKey(voucher.status);
  const recipient = voucherRecipient(voucher);
  const clientName = recipient.clientName;
  const money = (value: string): string => formatCurrency(Number(value), voucher.currency);

  return (
    <>
      <Stack.Screen options={{ title: "Comprobante" }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} showsVerticalScrollIndicator={false}>
          <VoucherHeaderCard
            voucher={voucher}
            title={voucherTitle(voucher)}
            clientName={clientName}
            status={status}
            totalLabel={money(voucher.totalAmount)}
            authorized={authorized}
            qrBase64={qrBase64}
          />
          <VoucherStatusBanner voucher={voucher} status={status} />
          <VoucherItemsCard voucher={voucher} money={money} />
          {hasText(recipient.docNumber) ? (
            <RecipientCard
              clientName={clientName}
              docType={recipient.docType}
              docNumber={recipient.docNumber}
              email={voucher.client?.email}
            />
          ) : null}
          {authorized ? <VoucherActions voucher={voucher} /> : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default function VoucherDetailScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["voucher", id],
    queryFn: () => getVoucher(id),
  });

  const authorized = Boolean(data?.cae) && isAuthorizedStatus(data?.status ?? "");

  const { data: qrBase64 } = useQuery({
    queryKey: ["voucher-qr", id],
    queryFn: () => apiFetchBase64(`/vouchers/${id}/qr.png`),
    enabled: authorized,
  });

  if (isLoading) return <Loading />;
  if (isError || !data) return <VoucherLoadError />;
  return <VoucherDetailContent voucher={data} authorized={authorized} qrBase64={qrBase64} />;
}
