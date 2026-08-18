import { useState } from 'react';
import { Eye, Share2 } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { documentTypeName, voucherTypeName } from '@chirola/shared';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Amount, Banner, Button, Card, Divider, Loading, StatusBadge } from '@/components/ds';
import { apiFetchBase64 } from '@/lib/api';
import { getVoucher, type VoucherDetail } from '@/lib/resources';
import { formatCurrency, formatDate, formatVoucherNumber } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';
import { type StatusKey } from '@/theme/tokens';

function toStatusKey(status: string, hasCae: boolean): StatusKey {
  const value = status.toLowerCase();
  if (value.includes('observ')) return 'observado';
  if (hasCae) return 'aprobado';
  if (value.includes('rechaz') || value.includes('reject')) return 'rechazado';
  return 'pendiente';
}

function observationsText(data: VoucherDetail): string {
  const observations = data.arcaObservations ?? [];
  if (observations.length === 0) {
    return 'ARCA la aprobó igual, pero conviene revisar el aviso.';
  }
  return observations
    .map(({ code, message }) => (code ? `(${code}) ${message}` : message))
    .join('\n');
}

export default function VoucherDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['voucher', id],
    queryFn: () => getVoucher(id),
  });

  const authorized = Boolean(data?.cae);

  const { data: qrBase64 } = useQuery({
    queryKey: ['voucher-qr', id],
    queryFn: () => apiFetchBase64(`/vouchers/${id}/qr.png`),
    enabled: authorized,
  });

  const downloadPdf = async () => {
    setError(null);
    setDownloading(true);
    try {
      const base64 = await apiFetchBase64(`/vouchers/${id}/pdf`);
      const file = new File(Paths.cache, `voucher-${id}.pdf`);
      try {
        file.write(base64, { encoding: 'base64' });
      } catch {
        file.delete();
        file.write(base64, { encoding: 'base64' });
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <Loading />;
  if (isError || !data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Comprobante' }} />
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: theme.font.regular, color: theme.colors.textPrimary }}>
            No se pudo cargar el comprobante.
          </Text>
        </SafeAreaView>
      </>
    );
  }

  const name = voucherTypeName[data.voucherType] ?? `Tipo ${data.voucherType}`;
  const number = formatVoucherNumber(data.salesPoint.number, data.number);
  const status = toStatusKey(data.status, authorized);
  const clientName = data.client?.legalName ?? 'Consumidor final';

  return (
    <>
      <Stack.Screen options={{ title: 'Comprobante' }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={{ alignItems: 'center' }}>
              <StatusBadge status={status} />
              <Text style={{ marginTop: 10, fontFamily: theme.font.bold, fontSize: theme.fontSize.subhead, color: theme.colors.textPrimary }}>
                {name} {number}
              </Text>
              <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
                {clientName} · {formatDate(data.voucherDate)}
              </Text>
              <View style={{ marginVertical: 10 }}>
                <Amount value={formatCurrency(Number(data.totalAmount))} size="xl" />
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
                  <Text style={{ fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, textAlign: 'center' }}>
                    CAE {data.cae}
                    {data.caeExpiration ? ` · vence ${formatDate(data.caeExpiration)}` : ''}
                  </Text>
                  <Text style={{ marginTop: 2, fontFamily: theme.font.regular, fontSize: theme.fontSize.micro, color: theme.colors.textTertiary, textAlign: 'center' }}>
                    El CAE prueba que ARCA aprobó este comprobante.
                  </Text>
                </>
              ) : null}
            </View>
          </Card>

          {status === 'observado' ? (
            <Banner
              kind="warning"
              title="Aprobada con observaciones"
              body={observationsText(data)}
            />
          ) : status === 'rechazado' ? (
            <Banner kind="error" title="ARCA rechazó este comprobante" body="No tiene validez fiscal. Corregí el dato observado y volvé a emitir." />
          ) : null}

          <Card>
            <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary, marginBottom: 8 }}>
              Detalle
            </Text>
            {data.items.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <Text style={{ flex: 1, fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textPrimary }}>
                  {Number(item.quantity)} × {item.description}
                </Text>
                <Text style={{ fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.callout, color: theme.colors.textPrimary }}>
                  {formatCurrency(Number(item.subtotal))}
                </Text>
              </View>
            ))}
            <Divider />
            <View style={{ height: 8 }} />
            <TotalRow label="Neto" value={formatCurrency(Number(data.netAmount))} />
            <TotalRow label="IVA" value={formatCurrency(Number(data.ivaAmount))} />
            <TotalRow label="Total" value={formatCurrency(Number(data.totalAmount))} bold />
          </Card>

          {data.client ? (
            <Card>
              <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary, marginBottom: 8 }}>
                Receptor
              </Text>
              <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.body, color: theme.colors.textPrimary }}>
                {clientName}
              </Text>
              <Text style={{ fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
                {documentTypeName[data.client.docType] ?? data.client.docType} {data.client.docNumber}
              </Text>
            </Card>
          ) : null}

          {error ? <Banner kind="error" title="No se pudo generar el PDF" body={error} /> : null}

          {authorized ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" full loading={downloading} icon={<Share2 size={18} color={theme.colors.actionSecondaryText} strokeWidth={2} />} onPress={downloadPdf}>
                  Enviar
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" full icon={<Eye size={18} color={theme.colors.actionSecondaryText} strokeWidth={2} />} onPress={downloadPdf}>
                  Ver PDF
                </Button>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const TotalRow = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ fontFamily: theme.font.regular, fontSize: bold ? theme.fontSize.body : theme.fontSize.callout, color: theme.colors.textSecondary }}>
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
