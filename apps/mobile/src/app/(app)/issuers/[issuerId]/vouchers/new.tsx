import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  DocumentType,
  ivaRates,
  issueVoucherSchema,
  requiresRecipientCuit,
  VoucherType,
} from '@chirola/shared';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Amount, Banner, BottomSheet, Button, Card, Chip, Input, ListItem, Segmented, Select } from '@/components/ds';
import { issueVoucher, listClients, type Client } from '@/lib/resources';
import { formatCurrency } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

interface ItemForm {
  description: string;
  quantity: string;
  unitPrice: string;
  ivaRate: number;
}

const newItem = (): ItemForm => ({ description: '', quantity: '1', unitPrice: '', ivaRate: 21 });

const voucherTypes = [
  { value: VoucherType.FACTURA_B, label: 'Factura B', hint: 'Para consumidores finales y monotributistas' },
  { value: VoucherType.FACTURA_A, label: 'Factura A', hint: 'Para responsables inscriptos (discrimina IVA)' },
  { value: VoucherType.FACTURA_C, label: 'Factura C', hint: 'La tuya si sos monotributista' },
];

const conceptOptions = [
  { value: 1 as const, label: 'Productos' },
  { value: 2 as const, label: 'Servicios' },
  { value: 3 as const, label: 'Ambos' },
];

const docTypeOptions = [
  { value: DocumentType.CUIT, label: 'CUIT' },
  { value: DocumentType.DNI, label: 'DNI' },
  { value: DocumentType.CONSUMIDOR_FINAL, label: 'Cons. Final' },
];

export default function NewVoucherScreen() {
  const theme = useTheme();
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
  const [sheet, setSheet] = useState<'tipo' | 'confirm' | null>(null);

  const { data: clients } = useQuery({
    queryKey: ['clients', issuerId],
    queryFn: () => listClients(issuerId),
  });

  const mutation = useMutation({
    mutationFn: issueVoucher,
    onSuccess: (res) => router.replace(`/(app)/vouchers/${res.id}`),
    onError: (e) => {
      setSheet(null);
      setError(e instanceof Error ? e.message : 'No se pudo emitir el comprobante.');
    },
  });

  const setItem = (index: number, patch: Partial<ItemForm>) =>
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));

  const chooseClient = (client: Client) => {
    setDocType(client.docType);
    setDocNumber(client.docNumber);
    setLegalName(client.legalName ?? '');
  };

  const totals = useMemo(() => {
    let net = 0;
    let iva = 0;
    for (const item of items) {
      const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      net += subtotal;
      iva += (subtotal * item.ivaRate) / 100;
    }
    return { net, iva, total: net + iva };
  }, [items]);

  const selectedType = voucherTypes.find((type) => type.value === voucherType);
  const requiresCuit = requiresRecipientCuit(voucherType);
  const clientLabel = legalName.trim() || (docType === DocumentType.CONSUMIDOR_FINAL ? 'Consumidor final' : docNumber);

  const buildPayload = () => ({
    issuerId,
    salesPoint: Number(salesPoint),
    voucherType,
    concept,
    recipient: { docType, docNumber: docNumber.trim(), legalName: legalName.trim() || undefined },
    items: items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      ivaRate: item.ivaRate,
    })),
  });

  const review = () => {
    setError(null);
    const parsed = issueVoucherSchema.safeParse(buildPayload());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá los datos de la factura.');
      return;
    }
    setSheet('confirm');
  };

  const emit = () => {
    const parsed = issueVoucherSchema.safeParse(buildPayload());
    if (!parsed.success) {
      setSheet(null);
      setError(parsed.error.issues[0]?.message ?? 'Revisá los datos de la factura.');
      return;
    }
    mutation.mutate(parsed.data);
  };

  if (mutation.isPending) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 }}>
          <ActivityIndicator size="large" color={theme.colors.actionPrimary} />
          <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.subhead, color: theme.colors.textPrimary }}>
            Emitiendo contra ARCA…
          </Text>
          <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary, textAlign: 'center' }}>
            No cierres la app. Esto tarda unos segundos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.statusRechazadoBg, alignItems: 'center', justifyContent: 'center' }}>
              <X size={44} color={theme.colors.statusRechazadoFg} strokeWidth={2.5} />
            </View>
            <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.heading, color: theme.colors.textPrimary, textAlign: 'center' }}>
              No se pudo emitir
            </Text>
            <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 280 }}>
              No se emitió nada ni se usó numeración. Podés corregir y volver a intentar.
            </Text>
          </View>
          <Banner kind="error" title="ARCA rechazó el comprobante" body={error} />
          <Button variant="primary" full onPress={() => setError(null)}>
            Corregir y reintentar
          </Button>
          <Button variant="ghost" full onPress={() => router.back()}>
            Salir
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Emitir comprobante' }} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Select
          label="Tipo de comprobante"
          value={selectedType?.label}
          hint={selectedType?.hint}
          onPress={() => setSheet('tipo')}
        />
        <Input label="Punto de venta" value={salesPoint} onChangeText={setSalesPoint} keyboardType="number-pad" mono />

        <Card>
          <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.caption, color: theme.colors.textPrimary, marginBottom: 8 }}>
            Receptor
          </Text>
          {clients && clients.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
              {clients.map((client) => (
                <Chip
                  key={client.id}
                  label={client.legalName ?? client.docNumber}
                  selected={docNumber === client.docNumber}
                  onPress={() => chooseClient(client)}
                />
              ))}
            </ScrollView>
          ) : null}
          <Segmented value={docType} options={docTypeOptions} onChange={setDocType} />
          <View style={{ height: 10 }} />
          <Input label="Número de documento" value={docNumber} onChangeText={setDocNumber} keyboardType="number-pad" mono />
          <View style={{ height: 10 }} />
          <Input label="Razón social" value={legalName} onChangeText={setLegalName} placeholder="Opcional" />
          {requiresCuit && docType !== DocumentType.CUIT ? (
            <View style={{ marginTop: 10 }}>
              <Banner kind="warning" title="La Factura A necesita CUIT del receptor" />
            </View>
          ) : null}
        </Card>

        <Segmented value={concept} options={conceptOptions} onChange={setConcept} label="Concepto" />

        {items.map((item, index) => {
          const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
          const itemIva = (subtotal * item.ivaRate) / 100;
          return (
            <Card key={index}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary }}>
                  Ítem {index + 1}
                </Text>
                {items.length > 1 ? (
                  <Button variant="ghost" size="sm" onPress={() => setItems((prev) => prev.filter((_, idx) => idx !== index))}>
                    Quitar
                  </Button>
                ) : null}
              </View>
              <Input label="Descripción" value={item.description} onChangeText={(v) => setItem(index, { description: v })} />
              <View style={{ height: 10 }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 96 }}>
                  <Input label="Cantidad" value={item.quantity} onChangeText={(v) => setItem(index, { quantity: v })} keyboardType="decimal-pad" mono />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Precio unitario" value={item.unitPrice} onChangeText={(v) => setItem(index, { unitPrice: v })} keyboardType="decimal-pad" mono prefix="$" />
                </View>
              </View>
              <View style={{ height: 10 }} />
              <Segmented value={item.ivaRate} options={ivaRates.map((rate) => ({ value: rate, label: `${rate}%` }))} onChange={(v) => setItem(index, { ivaRate: v })} label="IVA" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
                  IVA {item.ivaRate}%
                </Text>
                <Text style={{ fontFamily: theme.font.monoMedium, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
                  {formatCurrency(itemIva)}
                </Text>
              </View>
            </Card>
          );
        })}
        <Button variant="ghost" full onPress={() => setItems((prev) => [...prev, newItem()])}>
          + Agregar otro ítem
        </Button>
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle, backgroundColor: theme.colors.surfaceCard, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
            Total con IVA
          </Text>
          <Amount value={formatCurrency(totals.total)} />
        </View>
        <Button variant="primary" full onPress={review}>
          Revisar y emitir
        </Button>
      </View>

      <BottomSheet open={sheet === 'tipo'} title="Tipo de comprobante" onClose={() => setSheet(null)}>
        {voucherTypes.map((type) => (
          <ListItem
            key={type.value}
            title={type.label}
            subtitle={type.hint}
            onPress={() => {
              setVoucherType(type.value);
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'confirm'} title="Revisá antes de emitir" onClose={() => setSheet(null)}>
        <View style={{ backgroundColor: theme.colors.surfaceBrandSubtle, borderRadius: theme.radius.md, padding: 16, alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
            Vas a emitir
          </Text>
          <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.subhead, color: theme.colors.textPrimary, marginTop: 2 }}>
            {selectedType?.label}
          </Text>
          <View style={{ marginTop: 8 }}>
            <Amount value={formatCurrency(totals.total)} size="xl" />
          </View>
          <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, marginTop: 6 }}>
            a {clientLabel} · IVA incluido
          </Text>
        </View>
        <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, marginBottom: 12 }}>
          Una vez emitida es un documento legal: si hay un error, después se corrige con una Nota de Crédito.
        </Text>
        <Button variant="primary" full onPress={emit}>
          Confirmar y emitir
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}

