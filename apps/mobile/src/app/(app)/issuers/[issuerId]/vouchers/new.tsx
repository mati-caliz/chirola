import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArcaParamType,
  discriminatesIva,
  DocumentType,
  isCreditInvoice,
  issuableInvoiceTypes,
  issueVoucherSchema,
  ivaRates,
  LOCAL_CURRENCY,
  LOCAL_EXCHANGE_RATE,
  recipientIvaConditionName,
  requiresRecipientCuit,
  requiresServicePeriod,
  TaxTreatment,
  taxTreatmentName,
  TransmissionType,
  transmissionTypeLabel,
  TributeType,
  tributeTypeName,
  VoucherConcept,
  VoucherType,
  voucherTypeName,
  type TaxTreatmentType,
  type TransmissionTypeName,
  type VoucherConceptType,
} from '@chirola/shared';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Amount,
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  Input,
  ListItem,
  Segmented,
  Select,
} from '@/components/ds';
import {
  getExchangeRate,
  issueVoucher,
  listArcaParams,
  listClients,
  listCurrencies,
  listSalesPoints,
  lookupTaxpayer,
  type Client,
} from '@/lib/resources';
import { formatCurrency, toIsoDate } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

interface ItemForm {
  description: string;
  quantity: string;
  unitPrice: string;
  ivaRate: number;
  taxTreatment: TaxTreatmentType;
}

interface TributeForm {
  id: number;
  description: string;
  taxableBase: string;
  rate: string;
}

const DEFAULT_IVA_RATE = 21;
const NO_IVA_RATE = 0;
const SELECTABLE_CURRENCIES = [LOCAL_CURRENCY, 'DOL', 'EUR'];

const newItem = (): ItemForm => ({
  description: '',
  quantity: '1',
  unitPrice: '',
  ivaRate: DEFAULT_IVA_RATE,
  taxTreatment: TaxTreatment.TAXED,
});

const newTribute = (): TributeForm => ({
  id: TributeType.PROVINCIAL,
  description: '',
  taxableBase: '',
  rate: '',
});

const DEFAULT_INVOICE_TYPES = [
  VoucherType.FACTURA_B,
  VoucherType.FACTURA_A,
  VoucherType.FACTURA_C,
];

const voucherTypeHint: Record<number, string> = {
  [VoucherType.FACTURA_A]: 'Para responsables inscriptos (discrimina IVA)',
  [VoucherType.FACTURA_B]: 'Para consumidores finales y monotributistas',
  [VoucherType.FACTURA_C]: 'La tuya si sos monotributista',
  [VoucherType.FACTURA_M]: 'Si ARCA todavía no te habilitó la A',
  [VoucherType.FCE_FACTURA_A]: 'Crédito electrónico MiPyME, cobrás por CBU',
  [VoucherType.FCE_FACTURA_B]: 'Crédito electrónico MiPyME, cobrás por CBU',
  [VoucherType.FCE_FACTURA_C]: 'Crédito electrónico MiPyME, cobrás por CBU',
};

const conceptOptions = [
  { value: VoucherConcept.PRODUCTS, label: 'Productos' },
  { value: VoucherConcept.SERVICES, label: 'Servicios' },
  { value: VoucherConcept.PRODUCTS_AND_SERVICES, label: 'Ambos' },
];

const docTypeOptions = [
  { value: DocumentType.CUIT, label: 'CUIT' },
  { value: DocumentType.DNI, label: 'DNI' },
  { value: DocumentType.CONSUMIDOR_FINAL, label: 'Cons. Final' },
];

const taxTreatmentOptions = [
  { value: TaxTreatment.TAXED, label: taxTreatmentName.TAXED },
  { value: TaxTreatment.EXEMPT, label: taxTreatmentName.EXEMPT },
  { value: TaxTreatment.UNTAXED, label: taxTreatmentName.UNTAXED },
];

const transmissionOptions = [
  {
    value: TransmissionType.OPEN_CIRCULATION,
    label: transmissionTypeLabel[TransmissionType.OPEN_CIRCULATION],
  },
  {
    value: TransmissionType.COLLECTIVE_DEPOSIT,
    label: transmissionTypeLabel[TransmissionType.COLLECTIVE_DEPOSIT],
  },
];

const currentMonthPeriod = () => {
  const now = new Date();
  return {
    from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const todayIso = () => toIsoDate(new Date());

const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export default function NewVoucherScreen() {
  const theme = useTheme();
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();

  const [voucherType, setVoucherType] = useState<number>(VoucherType.FACTURA_B);
  const [salesPoint, setSalesPoint] = useState('1');
  const [concept, setConcept] = useState<VoucherConceptType>(VoucherConcept.PRODUCTS);
  const [servicePeriod, setServicePeriod] = useState(currentMonthPeriod);
  const [paymentDueDate, setPaymentDueDate] = useState(todayIso);
  const [transmissionType, setTransmissionType] = useState<TransmissionTypeName>(
    TransmissionType.OPEN_CIRCULATION,
  );
  const [docType, setDocType] = useState<number>(DocumentType.CONSUMIDOR_FINAL);
  const [docNumber, setDocNumber] = useState('0');
  const [legalName, setLegalName] = useState('');
  const [recipientIvaConditionId, setRecipientIvaConditionId] = useState<number | null>(
    null,
  );
  const [currency, setCurrency] = useState(LOCAL_CURRENCY);
  const [exchangeRate, setExchangeRate] = useState(String(LOCAL_EXCHANGE_RATE));
  const [items, setItems] = useState<ItemForm[]>([newItem()]);
  const [tributes, setTributes] = useState<TributeForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'tipo' | 'pdv' | 'moneda' | 'confirm' | null>(null);

  const { data: clients } = useQuery({
    queryKey: ['clients', issuerId],
    queryFn: () => listClients(issuerId),
  });

  const { data: salesPoints } = useQuery({
    queryKey: ['sales-points', issuerId],
    queryFn: () => listSalesPoints(issuerId),
  });

  const { data: enabledVoucherTypes } = useQuery({
    queryKey: ['params', issuerId, ArcaParamType.VOUCHER_TYPES],
    queryFn: () => listArcaParams(issuerId, ArcaParamType.VOUCHER_TYPES),
  });

  const { data: currencies } = useQuery({
    queryKey: ['currencies', issuerId],
    queryFn: () => listCurrencies(issuerId),
  });

  const mutation = useMutation({
    mutationFn: issueVoucher,
    onSuccess: (res) => router.replace(`/(app)/vouchers/${res.id}`),
    onError: (e) => {
      setSheet(null);
      setError(e instanceof Error ? e.message : 'No se pudo emitir el comprobante.');
    },
  });

  const exchangeRateLookup = useMutation({
    mutationFn: (currencyId: string) => getExchangeRate(issuerId, currencyId),
    onSuccess: (quote) => setExchangeRate(String(quote.rate)),
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'No se pudo traer la cotización.'),
  });

  const padronLookup = useMutation({
    mutationFn: () => lookupTaxpayer(issuerId, docNumber.trim()),
    onSuccess: (taxpayer) => {
      setLegalName(taxpayer.legalName);
      setRecipientIvaConditionId(taxpayer.ivaConditionId);
      setError(null);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'No se pudo consultar el padrón.'),
  });

  const voucherTypeOptions = useMemo(() => {
    const enabledIds = new Set((enabledVoucherTypes ?? []).map((param) => param.id));
    const available = issuableInvoiceTypes.filter((type) => enabledIds.has(type));
    const types = available.length > 0 ? available : DEFAULT_INVOICE_TYPES;
    return types.map((type) => ({
      value: type,
      label: voucherTypeName[type],
      hint: voucherTypeHint[type],
    }));
  }, [enabledVoucherTypes]);

  useEffect(() => {
    if (!voucherTypeOptions.some((option) => option.value === voucherType)) {
      setVoucherType(voucherTypeOptions[0].value);
    }
  }, [voucherTypeOptions, voucherType]);

  const currencyOptions = useMemo(() => {
    const byId = new Map((currencies ?? []).map((item) => [item.id, item.description]));
    return SELECTABLE_CURRENCIES.map((id) => ({
      value: id,
      label: id === LOCAL_CURRENCY ? 'Pesos' : (byId.get(id) ?? id),
    }));
  }, [currencies]);

  const setItem = (index: number, patch: Partial<ItemForm>) =>
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));

  const setTribute = (index: number, patch: Partial<TributeForm>) =>
    setTributes((prev) =>
      prev.map((tribute, idx) => (idx === index ? { ...tribute, ...patch } : tribute)),
    );

  const chooseClient = (client: Client) => {
    setDocType(client.docType);
    setDocNumber(client.docNumber);
    setLegalName(client.legalName ?? '');
  };

  const chooseCurrency = (currencyId: string) => {
    setCurrency(currencyId);
    setSheet(null);
    if (currencyId === LOCAL_CURRENCY) {
      setExchangeRate(String(LOCAL_EXCHANGE_RATE));
      return;
    }
    exchangeRateLookup.mutate(currencyId);
  };

  const chooseTaxTreatment = (index: number, taxTreatment: TaxTreatmentType) =>
    setItem(index, {
      taxTreatment,
      ivaRate: taxTreatment === TaxTreatment.TAXED ? DEFAULT_IVA_RATE : NO_IVA_RATE,
    });

  const needsServicePeriod = requiresServicePeriod(concept);
  const isFce = isCreditInvoice(voucherType);
  const needsPaymentDueDate = needsServicePeriod || isFce;
  const requiresCuit = requiresRecipientCuit(voucherType);
  const discriminates = discriminatesIva(voucherType);

  const totals = useMemo(() => {
    let net = 0;
    let iva = 0;
    let exempt = 0;
    let untaxed = 0;
    let gross = 0;

    for (const item of items) {
      const itemGross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      gross += itemGross;
      if (!discriminates) continue;
      if (item.taxTreatment === TaxTreatment.EXEMPT) {
        exempt += itemGross;
      } else if (item.taxTreatment === TaxTreatment.UNTAXED) {
        untaxed += itemGross;
      } else {
        const base = itemGross / (1 + item.ivaRate / 100);
        net += base;
        iva += itemGross - base;
      }
    }

    const tributeTotal = tributes.reduce(
      (acc, tribute) =>
        acc + ((Number(tribute.taxableBase) || 0) * (Number(tribute.rate) || 0)) / 100,
      0,
    );

    return {
      net: round2(discriminates ? net : gross),
      iva: round2(iva),
      exempt: round2(exempt),
      untaxed: round2(untaxed),
      tributes: round2(tributeTotal),
      total: round2(gross + tributeTotal),
    };
  }, [items, tributes, discriminates]);

  const selectedType = voucherTypeOptions.find((type) => type.value === voucherType);
  const hasSalesPoints = Boolean(salesPoints && salesPoints.length > 0);
  const selectedSalesPoint = salesPoints?.find((point) => String(point.number) === salesPoint);
  const salesPointLabel = selectedSalesPoint
    ? `${String(selectedSalesPoint.number).padStart(4, '0')}${selectedSalesPoint.description ? ` — ${selectedSalesPoint.description}` : ''}`
    : undefined;
  const selectedCurrency = currencyOptions.find((option) => option.value === currency);
  const clientLabel = legalName.trim() || (docType === DocumentType.CONSUMIDOR_FINAL ? 'Consumidor final' : docNumber);

  const buildPayload = () => ({
    issuerId,
    salesPoint: Number(salesPoint),
    voucherType,
    concept,
    recipient: {
      docType,
      docNumber: docNumber.trim(),
      legalName: legalName.trim() || undefined,
      ivaConditionId: recipientIvaConditionId ?? undefined,
    },
    items: items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      ivaRate: item.ivaRate,
      taxTreatment: item.taxTreatment,
    })),
    tributes:
      tributes.length > 0
        ? tributes.map((tribute) => ({
            id: tribute.id,
            description: tribute.description.trim(),
            taxableBase: Number(tribute.taxableBase),
            rate: Number(tribute.rate),
          }))
        : undefined,
    servicePeriod: needsServicePeriod ? servicePeriod : undefined,
    paymentDueDate: needsPaymentDueDate ? paymentDueDate : undefined,
    transmissionType: isFce ? transmissionType : undefined,
    currency,
    exchangeRate: Number(exchangeRate),
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
        {hasSalesPoints ? (
          <Select label="Punto de venta" value={salesPointLabel} onPress={() => setSheet('pdv')} />
        ) : (
          <Input
            label="Punto de venta"
            value={salesPoint}
            onChangeText={setSalesPoint}
            keyboardType="number-pad"
            mono
            hint="Sincronizá tus puntos de venta desde el emisor para elegirlos de una lista."
          />
        )}

        <Select
          label="Moneda"
          value={selectedCurrency?.label}
          hint={currency === LOCAL_CURRENCY ? undefined : `Cotización ${exchangeRate}`}
          onPress={() => setSheet('moneda')}
        />
        {currency !== LOCAL_CURRENCY ? (
          <Input
            label="Cotización"
            value={exchangeRate}
            onChangeText={setExchangeRate}
            keyboardType="decimal-pad"
            mono
            hint={
              exchangeRateLookup.isPending
                ? 'Consultando a ARCA…'
                : 'ARCA valida contra su propia cotización.'
            }
          />
        ) : null}

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
          {docType === DocumentType.CUIT ? (
            <Button
              variant="ghost"
              full
              onPress={() => padronLookup.mutate()}
              disabled={padronLookup.isPending}
            >
              {padronLookup.isPending ? 'Consultando…' : 'Buscar en padrón ARCA'}
            </Button>
          ) : null}
          <View style={{ height: 10 }} />
          <Input label="Razón social" value={legalName} onChangeText={setLegalName} placeholder="Opcional" />
          {recipientIvaConditionId !== null ? (
            <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, marginTop: 8 }}>
              Condición IVA: {recipientIvaConditionName[recipientIvaConditionId] ?? recipientIvaConditionId}
            </Text>
          ) : null}
          {requiresCuit && docType !== DocumentType.CUIT ? (
            <View style={{ marginTop: 10 }}>
              <Banner
                kind="warning"
                title={`${voucherTypeName[voucherType]} necesita CUIT del receptor`}
              />
            </View>
          ) : null}
        </Card>

        <Segmented value={concept} options={conceptOptions} onChange={setConcept} label="Concepto" />

        {needsServicePeriod ? (
          <Card>
            <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.caption, color: theme.colors.textPrimary, marginBottom: 8 }}>
              Período facturado
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Desde"
                  value={servicePeriod.from}
                  onChangeText={(v) => setServicePeriod((prev) => ({ ...prev, from: v }))}
                  placeholder="AAAA-MM-DD"
                  mono
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Hasta"
                  value={servicePeriod.to}
                  onChangeText={(v) => setServicePeriod((prev) => ({ ...prev, to: v }))}
                  placeholder="AAAA-MM-DD"
                  mono
                />
              </View>
            </View>
          </Card>
        ) : null}

        {needsPaymentDueDate ? (
          <Input
            label="Vencimiento de pago"
            value={paymentDueDate}
            onChangeText={setPaymentDueDate}
            placeholder="AAAA-MM-DD"
            mono
          />
        ) : null}

        {isFce ? (
          <Segmented
            value={transmissionType}
            options={transmissionOptions}
            onChange={setTransmissionType}
            label="Tipo de transmisión"
          />
        ) : null}

        {items.map((item, index) => {
          const itemGross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
          const taxed = discriminates && item.taxTreatment === TaxTreatment.TAXED;
          const itemIva = taxed ? itemGross - itemGross / (1 + item.ivaRate / 100) : 0;
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
              {discriminates ? (
                <>
                  <View style={{ height: 10 }} />
                  <Segmented
                    value={item.taxTreatment}
                    options={taxTreatmentOptions}
                    onChange={(v) => chooseTaxTreatment(index, v)}
                    label="Tratamiento"
                  />
                </>
              ) : null}
              {taxed ? (
                <>
                  <View style={{ height: 10 }} />
                  <Segmented
                    value={item.ivaRate}
                    options={ivaRates.map((rate) => ({ value: rate, label: `${rate}%` }))}
                    onChange={(v) => setItem(index, { ivaRate: v })}
                    label="IVA"
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
                      IVA {item.ivaRate}% incluido
                    </Text>
                    <Text style={{ fontFamily: theme.font.monoMedium, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
                      {formatCurrency(itemIva)}
                    </Text>
                  </View>
                </>
              ) : null}
            </Card>
          );
        })}
        <Button variant="ghost" full onPress={() => setItems((prev) => [...prev, newItem()])}>
          + Agregar otro ítem
        </Button>

        {tributes.map((tribute, index) => (
          <Card key={`tribute-${index}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary }}>
                {tributeTypeName[tribute.id] ?? 'Tributo'}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setTributes((prev) => prev.filter((_, idx) => idx !== index))}
              >
                Quitar
              </Button>
            </View>
            <Input
              label="Descripción"
              value={tribute.description}
              onChangeText={(v) => setTribute(index, { description: v })}
            />
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Base imponible"
                  value={tribute.taxableBase}
                  onChangeText={(v) => setTribute(index, { taxableBase: v })}
                  keyboardType="decimal-pad"
                  mono
                  prefix="$"
                />
              </View>
              <View style={{ width: 96 }}>
                <Input
                  label="Alícuota"
                  value={tribute.rate}
                  onChangeText={(v) => setTribute(index, { rate: v })}
                  keyboardType="decimal-pad"
                  mono
                />
              </View>
            </View>
          </Card>
        ))}
        <Button variant="ghost" full onPress={() => setTributes((prev) => [...prev, newTribute()])}>
          + Agregar percepción o tributo
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
        {voucherTypeOptions.map((type) => (
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

      <BottomSheet open={sheet === 'pdv'} title="Punto de venta" onClose={() => setSheet(null)}>
        {(salesPoints ?? []).map((point) => (
          <ListItem
            key={point.id}
            title={`Punto de venta ${String(point.number).padStart(4, '0')}`}
            subtitle={point.description ?? undefined}
            onPress={() => {
              setSalesPoint(String(point.number));
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'moneda'} title="Moneda" onClose={() => setSheet(null)}>
        {currencyOptions.map((option) => (
          <ListItem
            key={option.value}
            title={option.label}
            subtitle={option.value}
            onPress={() => chooseCurrency(option.value)}
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
