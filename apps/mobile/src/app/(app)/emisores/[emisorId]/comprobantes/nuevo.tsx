import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  alicuotasIva,
  emitirComprobanteSchema,
  requiereCuitReceptor,
  TipoComprobante,
  TipoDocumento,
} from '@chirola/shared';
import {
  Badge,
  BodyText,
  Button,
  Card,
  ErrorText,
  Label,
  OptionGroup,
  Screen,
  Subtitle,
  TextField,
  Title,
} from '@/components/ui';
import { emitirComprobante, listarClientes, type Cliente } from '@/lib/resources';
import { formatMoneda } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

interface ItemForm {
  descripcion: string;
  cantidad: string;
  precioUnit: string;
  alicuotaIva: number;
}

const nuevoItem = (): ItemForm => ({
  descripcion: '',
  cantidad: '1',
  precioUnit: '',
  alicuotaIva: 21,
});

export default function NuevaFacturaScreen() {
  const { emisorId } = useLocalSearchParams<{ emisorId: string }>();
  const router = useRouter();

  const [tipoCbte, setTipoCbte] = useState<number>(TipoComprobante.FACTURA_B);
  const [puntoVenta, setPuntoVenta] = useState('1');
  const [concepto, setConcepto] = useState<1 | 2 | 3>(1);
  const [tipoDoc, setTipoDoc] = useState<number>(TipoDocumento.CONSUMIDOR_FINAL);
  const [numeroDoc, setNumeroDoc] = useState('0');
  const [razonSocial, setRazonSocial] = useState('');
  const [items, setItems] = useState<ItemForm[]>([nuevoItem()]);
  const [error, setError] = useState<string | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ['clientes', emisorId],
    queryFn: () => listarClientes(emisorId),
  });

  const mutation = useMutation({
    mutationFn: emitirComprobante,
    onSuccess: (res) => router.replace(`/(app)/comprobantes/${res.id}`),
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo emitir el comprobante.'),
  });

  function setItem(i: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function elegirCliente(c: Cliente) {
    setTipoDoc(c.tipoDoc);
    setNumeroDoc(c.numeroDoc);
    setRazonSocial(c.razonSocial ?? '');
  }

  const totales = useMemo(() => {
    let neto = 0;
    let iva = 0;
    for (const it of items) {
      const cant = Number(it.cantidad) || 0;
      const precio = Number(it.precioUnit) || 0;
      const sub = cant * precio;
      neto += sub;
      iva += (sub * it.alicuotaIva) / 100;
    }
    return { neto, iva, total: neto + iva };
  }, [items]);

  function onSubmit() {
    setError(null);
    const payload = {
      emisorId,
      puntoVenta: Number(puntoVenta),
      tipoCbte,
      concepto,
      receptor: {
        tipoDoc,
        numeroDoc: numeroDoc.trim(),
        razonSocial: razonSocial.trim() || undefined,
      },
      items: items.map((it) => ({
        descripcion: it.descripcion.trim(),
        cantidad: Number(it.cantidad),
        precioUnit: Number(it.precioUnit),
        alicuotaIva: it.alicuotaIva,
      })),
    };
    const parsed = emitirComprobanteSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá los datos de la factura.');
      return;
    }
    mutation.mutate(parsed.data);
  }

  const pideCuit = requiereCuitReceptor(tipoCbte);

  return (
    <>
      <Stack.Screen options={{ title: 'Nueva factura' }} />
      <Screen>
        <Title>Emitir comprobante</Title>

        <OptionGroup<number>
          label="Tipo"
          value={tipoCbte}
          onChange={setTipoCbte}
          options={[
            { label: 'Factura A', value: TipoComprobante.FACTURA_A },
            { label: 'Factura B', value: TipoComprobante.FACTURA_B },
            { label: 'Factura C', value: TipoComprobante.FACTURA_C },
          ]}
        />
        <TextField
          label="Punto de venta"
          value={puntoVenta}
          onChangeText={setPuntoVenta}
          keyboardType="number-pad"
        />
        <OptionGroup<1 | 2 | 3>
          label="Concepto"
          value={concepto}
          onChange={setConcepto}
          options={[
            { label: 'Productos', value: 1 },
            { label: 'Servicios', value: 2 },
            { label: 'Ambos', value: 3 },
          ]}
        />

        <Card>
          <Label>Receptor</Label>
          {clientes && clientes.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {clientes.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => elegirCliente(c)}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: '#ccc', paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 13 }}>{c.razonSocial ?? c.numeroDoc}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <OptionGroup<number>
            label="Tipo de documento"
            value={tipoDoc}
            onChange={setTipoDoc}
            options={[
              { label: 'CUIT', value: TipoDocumento.CUIT },
              { label: 'DNI', value: TipoDocumento.DNI },
              { label: 'Cons. Final', value: TipoDocumento.CONSUMIDOR_FINAL },
            ]}
          />
          <TextField
            label="Número de documento"
            value={numeroDoc}
            onChangeText={setNumeroDoc}
            keyboardType="number-pad"
          />
          <TextField
            label="Razón social"
            value={razonSocial}
            onChangeText={setRazonSocial}
            placeholder="Opcional"
          />
          {pideCuit && tipoDoc !== TipoDocumento.CUIT ? (
            <Badge text="La Factura A requiere CUIT del receptor" tone="warn" />
          ) : null}
        </Card>

        <Label>Ítems</Label>
        {items.map((it, i) => (
          <Card key={i}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <BodyText>Ítem {i + 1}</BodyText>
              {items.length > 1 ? (
                <Pressable onPress={() => setItems((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                  <Text style={{ color: '#E5484D', fontWeight: '600' }}>Quitar</Text>
                </Pressable>
              ) : null}
            </View>
            <TextField
              label="Descripción"
              value={it.descripcion}
              onChangeText={(v) => setItem(i, { descripcion: v })}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Cantidad"
                  value={it.cantidad}
                  onChangeText={(v) => setItem(i, { cantidad: v })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Precio unit."
                  value={it.precioUnit}
                  onChangeText={(v) => setItem(i, { precioUnit: v })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <OptionGroup<number>
              label="IVA %"
              value={it.alicuotaIva}
              onChange={(v) => setItem(i, { alicuotaIva: v })}
              options={alicuotasIva.map((a) => ({ label: `${a}%`, value: a }))}
            />
          </Card>
        ))}
        <Button title="+ Agregar ítem" variant="secondary" onPress={() => setItems((p) => [...p, nuevoItem()])} />

        <Card>
          <Row label="Neto" value={formatMoneda(totales.neto)} />
          <Row label="IVA" value={formatMoneda(totales.iva)} />
          <Row label="Total" value={formatMoneda(totales.total)} bold />
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button title="Emitir y solicitar CAE" onPress={onSubmit} loading={mutation.isPending} />
      </Screen>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Subtitle>{label}</Subtitle>
      <Text style={{ color: c.text, fontWeight: bold ? '700' : '500', fontSize: bold ? 17 : 15 }}>
        {value}
      </Text>
    </View>
  );
}
