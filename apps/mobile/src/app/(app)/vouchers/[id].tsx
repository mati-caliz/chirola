import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { documentTypeName, isAuthorizedStatus, LOCAL_CURRENCY, voucherTypeName } from "@chirola/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Amount, Banner, Card, Divider, Loading, StatusBadge } from "@/components/ds";
import { apiFetchBase64 } from "@/lib/api";
import { getVoucher, type VoucherDetail } from "@/lib/resources";
import { formatCurrency, formatDate, formatVoucherNumber } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { voucherStatusKey } from "@/lib/voucher-status";
import { VoucherActions } from "@/components/vouchers/VoucherActions";

function observationsText(data: VoucherDetail): string {
  const observations = data.arcaObservations ?? [];
  if (observations.length === 0) {
    return "ARCA la aprobó igual, pero conviene revisar el aviso.";
  }
  return observations.map(({ code, message }) => (code ? `(${code}) ${message}` : message)).join("\n");
}

export default function VoucherDetailScreen() {
  const theme = useTheme();
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
  if (isError || !data) {
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
  }

  const name = voucherTypeName[data.voucherType] ?? `Tipo ${data.voucherType}`;
  const number = formatVoucherNumber(data.salesPoint.number, data.number);
  const status = voucherStatusKey(data.status);
  const clientName = data.recipientName ?? data.client?.legalName ?? "Consumidor final";
  const recipientDocType = data.recipientDocType ?? data.client?.docType ?? null;
  const recipientDocNumber = data.recipientDocNumber ?? data.client?.docNumber ?? null;
  const money = (value: string) => formatCurrency(Number(value), data.currency);

  return (
    <>
      <Stack.Screen options={{ title: "Comprobante" }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={{ alignItems: "center" }}>
              <StatusBadge status={status} />
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: theme.font.bold,
                  fontSize: theme.fontSize.subhead,
                  color: theme.colors.textPrimary,
                }}
              >
                {name} {number}
              </Text>
              <Text
                style={{
                  fontFamily: theme.font.regular,
                  fontSize: theme.fontSize.caption,
                  color: theme.colors.textSecondary,
                }}
              >
                {clientName} · {formatDate(data.voucherDate)}
              </Text>
              <View style={{ marginVertical: 10 }}>
                <Amount value={money(data.totalAmount)} size="xl" />
              </View>
              {authorized && qrBase64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${qrBase64}` }}
                  style={{ width: 132, height: 132, marginVertical: 8 }}
                  contentFit="contain"
                />
              ) : null}
              {authorized ? (
                <>
                  <Text
                    style={{
                      fontFamily: theme.font.monoRegular,
                      fontSize: theme.fontSize.caption,
                      color: theme.colors.textSecondary,
                      textAlign: "center",
                    }}
                  >
                    CAE {data.cae}
                    {data.caeExpiration ? ` · vence ${formatDate(data.caeExpiration)}` : ""}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontFamily: theme.font.regular,
                      fontSize: theme.fontSize.micro,
                      color: theme.colors.textTertiary,
                      textAlign: "center",
                    }}
                  >
                    El CAE prueba que ARCA aprobó este comprobante.
                  </Text>
                </>
              ) : null}
            </View>
          </Card>

          {status === "observado" ? (
            <Banner kind="warning" title="Aprobada con observaciones" body={observationsText(data)} />
          ) : status === "rechazado" ? (
            <Banner
              kind="error"
              title="ARCA rechazó este comprobante"
              body="No tiene validez fiscal. Corregí el dato observado y volvé a emitir."
            />
          ) : null}

          <Card>
            <Text
              style={{
                fontFamily: theme.font.semibold,
                fontSize: theme.fontSize.micro,
                letterSpacing: 0.66,
                textTransform: "uppercase",
                color: theme.colors.textTertiary,
                marginBottom: 8,
              }}
            >
              Detalle
            </Text>
            {data.items.map((item) => (
              <View
                key={item.id}
                style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 6 }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontFamily: theme.font.regular,
                    fontSize: theme.fontSize.callout,
                    color: theme.colors.textPrimary,
                  }}
                >
                  {Number(item.quantity)} × {item.description}
                </Text>
                <Text
                  style={{
                    fontFamily: theme.font.monoRegular,
                    fontSize: theme.fontSize.callout,
                    color: theme.colors.textPrimary,
                  }}
                >
                  {money(item.subtotal)}
                </Text>
              </View>
            ))}
            <Divider />
            <View style={{ height: 8 }} />
            <TotalRow label="Neto" value={money(data.netAmount)} />
            <TotalRow label="IVA" value={money(data.ivaAmount)} />
            <TotalRow label="Total" value={money(data.totalAmount)} bold />
            {data.currency !== LOCAL_CURRENCY ? (
              <TotalRow label="Cotización" value={Number(data.exchangeRate).toLocaleString("es-AR")} />
            ) : null}
          </Card>

          {recipientDocNumber ? (
            <Card>
              <Text
                style={{
                  fontFamily: theme.font.semibold,
                  fontSize: theme.fontSize.micro,
                  letterSpacing: 0.66,
                  textTransform: "uppercase",
                  color: theme.colors.textTertiary,
                  marginBottom: 8,
                }}
              >
                Receptor
              </Text>
              <Text
                style={{
                  fontFamily: theme.font.regular,
                  fontSize: theme.fontSize.body,
                  color: theme.colors.textPrimary,
                }}
              >
                {clientName}
              </Text>
              <Text
                style={{
                  fontFamily: theme.font.monoRegular,
                  fontSize: theme.fontSize.caption,
                  color: theme.colors.textSecondary,
                }}
              >
                {recipientDocType === null ? "" : (documentTypeName[recipientDocType] ?? recipientDocType)}{" "}
                {recipientDocNumber}
              </Text>
              {data.client?.email ? (
                <Text
                  style={{
                    fontFamily: theme.font.regular,
                    fontSize: theme.fontSize.caption,
                    color: theme.colors.textSecondary,
                  }}
                >
                  {data.client.email}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {authorized ? <VoucherActions voucher={data} /> : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const TotalRow = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
      <Text
        style={{
          fontFamily: theme.font.regular,
          fontSize: bold ? theme.fontSize.body : theme.fontSize.callout,
          color: theme.colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: bold ? theme.font.monoSemibold : theme.font.monoRegular,
          fontSize: bold ? theme.fontSize.subhead : theme.fontSize.callout,
          color: theme.colors.textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
};
