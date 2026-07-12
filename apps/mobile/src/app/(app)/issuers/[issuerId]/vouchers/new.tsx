import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ivaRates,
  issueVoucherSchema,
  requiresRecipientCuit,
  VoucherType,
  DocumentType,
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
import { issueVoucher, listClients, type Client } from '@/lib/resources';
import { formatCurrency } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

interface ItemForm {
  description: string;
  quantity: string;
  unitPrice: string;
  ivaRate: number;
}

const newItem = (): ItemForm => ({
  description: '',
  quantity: '1',
  unitPrice: '',
  ivaRate: 21,
});

export default function NewVoucherScreen() {
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();

  const [voucherType, setVoucherType] = useState<number>(VoucherType.FACTURA_B);
  const [salesPoint, setSalesPoint] = useState('1');
  const [concept, setConcept] = useState<1 | 2 | 3>(1);
  const [docType, setDocType] = useState<number>(DocumentType.CONSUMIDOR_FINAL);
  const [docNumber, setDocNumber] = useState('0');
  const [legalName, setLegalName] = useState('');
  const [items, setItems] = useState<ItemForm[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ['clients', issuerId],
    queryFn: () => listClients(issuerId),
  });

  const mutation = useMutation({
    mutationFn: issueVoucher,
    onSuccess: (res) => router.replace(`/(app)/vouchers/${res.id}`),
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo emitir el comprobante.'),
  });

  function setItem(index: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function chooseClient(client: Client) {
    setDocType(client.docType);
    setDocNumber(client.docNumber);
    setLegalName(client.legalName ?? '');
  }

  const totals = useMemo(() => {
    let net = 0;
    let iva = 0;
    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const subtotal = quantity * unitPrice;
      net += subtotal;
      iva += (subtotal * item.ivaRate) / 100;
    }
    return { net, iva, total: net + iva };
  }, [items]);

  function onSubmit() {
    setError(null);
    const payload = {
      issuerId,
      salesPoint: Number(salesPoint),
      voucherType,
      concept,
      recipient: {
        docType,
        docNumber: docNumber.trim(),
        legalName: legalName.trim() || undefined,
      },
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        ivaRate: item.ivaRate,
      })),
    };
    const parsed = issueVoucherSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá los datos de la factura.');
      return;
    }
    mutation.mutate(parsed.data);
  }

  const requiresCuit = requiresRecipientCuit(voucherType);

  return (
    <>
      <Stack.Screen options={{ title: 'Nueva factura' }} />
      <Screen>
        <Title>Emitir comprobante</Title>

        <OptionGroup<number>
          label="Tipo"
          value={voucherType}
          onChange={setVoucherType}
          options={[
            { label: 'Factura A', value: VoucherType.FACTURA_A },
            { label: 'Factura B', value: VoucherType.FACTURA_B },
            { label: 'Factura C', value: VoucherType.FACTURA_C },
          ]}
        />
        <TextField
          label="Punto de venta"
          value={salesPoint}
          onChangeText={setSalesPoint}
          keyboardType="number-pad"
        />
        <OptionGroup<1 | 2 | 3>
          label="Concepto"
          value={concept}
          onChange={setConcept}
          options={[
            { label: 'Productos', value: 1 },
            { label: 'Servicios', value: 2 },
            { label: 'Ambos', value: 3 },
          ]}
        />

        <Card>
          <Label>Receptor</Label>
          {clients && clients.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {clients.map((client) => (
                <Pressable
                  key={client.id}
                  onPress={() => chooseClient(client)}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: '#ccc', paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 13 }}>{client.legalName ?? client.docNumber}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <OptionGroup<number>
            label="Tipo de documento"
            value={docType}
            onChange={setDocType}
            options={[
              { label: 'CUIT', value: DocumentType.CUIT },
              { label: 'DNI', value: DocumentType.DNI },
              { label: 'Cons. Final', value: DocumentType.CONSUMIDOR_FINAL },
            ]}
          />
          <TextField
            label="Número de documento"
            value={docNumber}
            onChangeText={setDocNumber}
            keyboardType="number-pad"
          />
          <TextField
            label="Razón social"
            value={legalName}
            onChangeText={setLegalName}
            placeholder="Opcional"
          />
          {requiresCuit && docType !== DocumentType.CUIT ? (
            <Badge text="La Factura A requiere CUIT del receptor" tone="warn" />
          ) : null}
        </Card>

        <Label>Ítems</Label>
        {items.map((item, index) => (
          <Card key={index}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <BodyText>Ítem {index + 1}</BodyText>
              {items.length > 1 ? (
                <Pressable onPress={() => setItems((prev) => prev.filter((_, idx) => idx !== index))} hitSlop={8}>
                  <Text style={{ color: '#E5484D', fontWeight: '600' }}>Quitar</Text>
                </Pressable>
              ) : null}
            </View>
            <TextField
              label="Descripción"
              value={item.description}
              onChangeText={(v) => setItem(index, { description: v })}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Cantidad"
                  value={item.quantity}
                  onChangeText={(v) => setItem(index, { quantity: v })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Precio unit."
                  value={item.unitPrice}
                  onChangeText={(v) => setItem(index, { unitPrice: v })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <OptionGroup<number>
              label="IVA %"
              value={item.ivaRate}
              onChange={(v) => setItem(index, { ivaRate: v })}
              options={ivaRates.map((rate) => ({ label: `${rate}%`, value: rate }))}
            />
          </Card>
        ))}
        <Button title="+ Agregar ítem" variant="secondary" onPress={() => setItems((prev) => [...prev, newItem()])} />

        <Card>
          <Row label="Neto" value={formatCurrency(totals.net)} />
          <Row label="IVA" value={formatCurrency(totals.iva)} />
          <Row label="Total" value={formatCurrency(totals.total)} bold />
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
