import { useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  voucherTypeName,
  documentTypeName,
} from '@chirola/shared';
import {
  Badge,
  BodyText,
  Button,
  Card,
  Centered,
  ErrorText,
  Label,
  Loading,
  Screen,
  Subtitle,
  Title,
} from '@/components/ui';
import { apiFetchBase64 } from '@/lib/api';
import { getVoucher } from '@/lib/resources';
import { formatDate, formatCurrency, formatVoucherNumber } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
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

  async function downloadPdf() {
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
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) return <Loading />;
  if (isError || !data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Comprobante' }} />
        <Centered>
          <BodyText>No se pudo cargar el comprobante.</BodyText>
        </Centered>
      </>
    );
  }

  const name = voucherTypeName[data.voucherType] ?? `Tipo ${data.voucherType}`;

  return (
    <>
      <Stack.Screen options={{ title: 'Comprobante' }} />
      <Screen>
        <View style={{ gap: 4 }}>
          <Title>{name}</Title>
          <Subtitle>N° {formatVoucherNumber(data.salesPoint.number, data.number)}</Subtitle>
          {authorized ? (
            <Badge text="Autorizado por ARCA" tone="ok" />
          ) : (
            <Badge text={data.status} tone="warn" />
          )}
        </View>

        <Card>
          <Label>Emisor</Label>
          <BodyText>{data.issuer.legalName}</BodyText>
          <Subtitle>CUIT {data.issuer.cuit}</Subtitle>
          <View style={{ height: 8 }} />
          <Label>Receptor</Label>
          {data.client ? (
            <>
              <BodyText>{data.client.legalName ?? 'Sin razón social'}</BodyText>
              <Subtitle>
                {documentTypeName[data.client.docType] ?? data.client.docType}{' '}
                {data.client.docNumber}
              </Subtitle>
            </>
          ) : (
            <Subtitle>Consumidor final</Subtitle>
          )}
          <View style={{ height: 8 }} />
          <Label>Fecha</Label>
          <BodyText>{formatDate(data.voucherDate)}</BodyText>
        </Card>

        <Card>
          <Label>Ítems</Label>
          {data.items.map((item) => (
            <View
              key={item.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
            >
              <BodyText>
                {Number(item.quantity)} × {item.description}
              </BodyText>
              <BodyText>{formatCurrency(Number(item.subtotal))}</BodyText>
            </View>
          ))}
          <View style={{ height: 8 }} />
          <TotalRow label="Neto" value={formatCurrency(Number(data.netAmount))} color={c.colors.textPrimary} />
          <TotalRow label="IVA" value={formatCurrency(Number(data.ivaAmount))} color={c.colors.textPrimary} />
          <TotalRow label="Total" value={formatCurrency(Number(data.totalAmount))} color={c.colors.textPrimary} bold />
        </Card>

        {authorized ? (
          <Card>
            <Label>CAE</Label>
            <BodyText>{data.cae}</BodyText>
            {data.caeExpiration ? <Subtitle>Vence {formatDate(data.caeExpiration)}</Subtitle> : null}
            {qrBase64 ? (
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <Image
                  source={{ uri: `data:image/png;base64,${qrBase64}` }}
                  style={{ width: 180, height: 180 }}
                  contentFit="contain"
                />
              </View>
            ) : null}
          </Card>
        ) : null}

        <ErrorText>{error}</ErrorText>
        {authorized ? (
          <Button title="Descargar / compartir PDF" onPress={downloadPdf} loading={downloading} />
        ) : null}
      </Screen>
    </>
  );
}

function TotalRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Subtitle>{label}</Subtitle>
      <Text style={{ color, fontWeight: bold ? '700' : '500', fontSize: bold ? 17 : 15 }}>
        {value}
      </Text>
    </View>
  );
}
