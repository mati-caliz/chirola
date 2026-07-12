import { useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  nombreTipoComprobante,
  nombreTipoDocumento,
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
import { obtenerComprobante } from '@/lib/resources';
import { formatFecha, formatMoneda, formatNumeroCbte } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

export default function ComprobanteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['comprobante', id],
    queryFn: () => obtenerComprobante(id),
  });

  const autorizado = Boolean(data?.cae);

  const { data: qrBase64 } = useQuery({
    queryKey: ['comprobante-qr', id],
    queryFn: () => apiFetchBase64(`/comprobantes/${id}/qr.png`),
    enabled: autorizado,
  });

  async function descargarPdf() {
    setError(null);
    setDescargando(true);
    try {
      const base64 = await apiFetchBase64(`/comprobantes/${id}/pdf`);
      const file = new File(Paths.cache, `comprobante-${id}.pdf`);
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
      setDescargando(false);
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

  const nombre = nombreTipoComprobante[data.tipoCbte] ?? `Tipo ${data.tipoCbte}`;

  return (
    <>
      <Stack.Screen options={{ title: 'Comprobante' }} />
      <Screen>
        <View style={{ gap: 4 }}>
          <Title>{nombre}</Title>
          <Subtitle>N° {formatNumeroCbte(data.puntoVenta.numero, data.numero)}</Subtitle>
          {autorizado ? (
            <Badge text="Autorizado por ARCA" tone="ok" />
          ) : (
            <Badge text={data.estado} tone="warn" />
          )}
        </View>

        <Card>
          <Label>Emisor</Label>
          <BodyText>{data.emisor.razonSocial}</BodyText>
          <Subtitle>CUIT {data.emisor.cuit}</Subtitle>
          <View style={{ height: 8 }} />
          <Label>Receptor</Label>
          {data.cliente ? (
            <>
              <BodyText>{data.cliente.razonSocial ?? 'Sin razón social'}</BodyText>
              <Subtitle>
                {nombreTipoDocumento[data.cliente.tipoDoc] ?? data.cliente.tipoDoc}{' '}
                {data.cliente.numeroDoc}
              </Subtitle>
            </>
          ) : (
            <Subtitle>Consumidor final</Subtitle>
          )}
          <View style={{ height: 8 }} />
          <Label>Fecha</Label>
          <BodyText>{formatFecha(data.fechaCbte)}</BodyText>
        </Card>

        <Card>
          <Label>Ítems</Label>
          {data.items.map((it) => (
            <View
              key={it.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
            >
              <BodyText>
                {Number(it.cantidad)} × {it.descripcion}
              </BodyText>
              <BodyText>{formatMoneda(Number(it.subtotal))}</BodyText>
            </View>
          ))}
          <View style={{ height: 8 }} />
          <TotalRow label="Neto" value={formatMoneda(Number(data.impNeto))} color={c.text} />
          <TotalRow label="IVA" value={formatMoneda(Number(data.impIva))} color={c.text} />
          <TotalRow label="Total" value={formatMoneda(Number(data.impTotal))} color={c.text} bold />
        </Card>

        {autorizado ? (
          <Card>
            <Label>CAE</Label>
            <BodyText>{data.cae}</BodyText>
            {data.caeVto ? <Subtitle>Vence {formatFecha(data.caeVto)}</Subtitle> : null}
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
        {autorizado ? (
          <Button title="Descargar / compartir PDF" onPress={descargarPdf} loading={descargando} />
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
