import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArcaParamType,
  isCreditInvoice,
  issuableInvoiceTypes,
  ivaRates,
  issueVoucherSchema,
  LOCAL_CURRENCY,
  LOCAL_EXCHANGE_RATE,
  requiresRecipientCuit,
  recipientIvaConditionName,
  requiresServicePeriod,
  TaxTreatment,
  taxTreatmentName,
  TransmissionType,
  transmissionTypeLabel,
  TributeType,
  tributeTypeName,
  type TransmissionTypeName,
  VoucherConcept,
  VoucherType,
  voucherTypeName,
  DocumentType,
  type TaxTreatmentType,
  type VoucherConceptType,
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
import {
  getExchangeRate,
  issueVoucher,
  listArcaParams,
  listClients,
  listCurrencies,
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

const DEFAULT_INVOICE_TYPES = [
  VoucherType.FACTURA_A,
  VoucherType.FACTURA_B,
  VoucherType.FACTURA_C,
];

const SELECTABLE_CURRENCIES = [LOCAL_CURRENCY, 'DOL', 'EUR'];

const DEFAULT_IVA_RATE = 21;
const NO_IVA_RATE = 0;

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

const currentMonthPeriod = () => {
  const today = new Date();
  return {
    from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
};

const todayIso = () => toIsoDate(new Date());

export default function NewVoucherScreen() {
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

  const { data: clients } = useQuery({
    queryKey: ['clients', issuerId],
    queryFn: () => listClients(issuerId),
  });

  const mutation = useMutation({
    mutationFn: issueVoucher,
    onSuccess: (res) => router.replace(`/(app)/vouchers/${res.id}`),
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo emitir el comprobante.'),
  });

  const { data: currencies } = useQuery({
    queryKey: ['currencies', issuerId],
    queryFn: () => listCurrencies(issuerId),
  });

  const { data: enabledVoucherTypes } = useQuery({
    queryKey: ['params', issuerId, ArcaParamType.VOUCHER_TYPES],
    queryFn: () => listArcaParams(issuerId, ArcaParamType.VOUCHER_TYPES),
  });

  const exchangeRateLookup = useMutation({
    mutationFn: (currencyId: string) => getExchangeRate(issuerId, currencyId),
    onSuccess: (quote) => setExchangeRate(String(quote.rate)),
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'No se pudo obtener la cotización.'),
  });

  function chooseCurrency(currencyId: string) {
    setCurrency(currencyId);
    if (currencyId === LOCAL_CURRENCY) {
      setExchangeRate(String(LOCAL_EXCHANGE_RATE));
      return;
    }
    exchangeRateLookup.mutate(currencyId);
  }

  const voucherTypeOptions = useMemo(() => {
    const enabledIds = new Set((enabledVoucherTypes ?? []).map((param) => param.id));
    const available = issuableInvoiceTypes.filter((type) => enabledIds.has(type));
    const types = available.length > 0 ? available : DEFAULT_INVOICE_TYPES;
    return types.map((type) => ({ label: voucherTypeName[type], value: type }));
  }, [enabledVoucherTypes]);

  useEffect(() => {
    if (!voucherTypeOptions.some((option) => option.value === voucherType)) {
      setVoucherType(voucherTypeOptions[0].value);
    }
  }, [voucherTypeOptions, voucherType]);

  const currencyOptions = useMemo(() => {
    const byId = new Map((currencies ?? []).map((item) => [item.id, item.description]));
    return SELECTABLE_CURRENCIES.map((id) => ({
      label: id === LOCAL_CURRENCY ? 'Pesos' : (byId.get(id) ?? id),
      value: id,
    }));
  }, [currencies]);

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

  function setItem(index: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function setTribute(index: number, patch: Partial<TributeForm>) {
    setTributes((prev) =>
      prev.map((tribute, idx) => (idx === index ? { ...tribute, ...patch } : tribute)),
    );
  }

  function chooseClient(client: Client) {
    setDocType(client.docType);
    setDocNumber(client.docNumber);
    setLegalName(client.legalName ?? '');
    setRecipientIvaConditionId(null);
  }

  const totals = useMemo(() => {
    let taxedGross = 0;
    let exempt = 0;
    let untaxed = 0;
    for (const item of items) {
      const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      if (item.taxTreatment === TaxTreatment.EXEMPT) exempt += gross;
      else if (item.taxTreatment === TaxTreatment.UNTAXED) untaxed += gross;
      else taxedGross += gross;
    }

    const tributeAmount = tributes.reduce(
      (acc, tribute) =>
        acc + ((Number(tribute.taxableBase) || 0) * (Number(tribute.rate) || 0)) / 100,
      0,
    );

    if (!requiresRecipientCuit(voucherType)) {
      const itemsTotal = taxedGross + exempt + untaxed;
      return {
        net: itemsTotal,
        iva: 0,
        exempt: 0,
        untaxed: 0,
        tributeAmount,
        total: itemsTotal + tributeAmount,
      };
    }

    let net = 0;
    let iva = 0;
    for (const item of items) {
      if (item.taxTreatment !== TaxTreatment.TAXED) continue;
      const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const taxableBase = gross / (1 + item.ivaRate / 100);
      net += taxableBase;
      iva += gross - taxableBase;
    }

    return {
      net,
      iva,
      exempt,
      untaxed,
      tributeAmount,
      total: net + iva + exempt + untaxed + tributeAmount,
    };
  }, [items, tributes, voucherType]);

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
        ivaConditionId: recipientIvaConditionId ?? undefined,
      },
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        ivaRate: item.taxTreatment === TaxTreatment.TAXED ? item.ivaRate : 0,
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
      servicePeriod: requiresServicePeriod(concept) ? servicePeriod : undefined,
      paymentDueDate: needsPaymentDueDate ? paymentDueDate : undefined,
      transmissionType: isCreditInvoice(voucherType) ? transmissionType : undefined,
      currency,
      exchangeRate: Number(exchangeRate),
    };
    const parsed = issueVoucherSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá los datos de la factura.');
      return;
    }
    mutation.mutate(parsed.data);
  }

  const requiresCuit = requiresRecipientCuit(voucherType);
  const needsServicePeriod = requiresServicePeriod(concept);
  const needsPaymentDueDate = needsServicePeriod || isCreditInvoice(voucherType);

  return (
    <>
      <Stack.Screen options={{ title: 'Nueva factura' }} />
      <Screen>
        <Title>Emitir comprobante</Title>

        <OptionGroup<number>
          label="Tipo"
          value={voucherType}
          onChange={setVoucherType}
          options={voucherTypeOptions}
        />
        <TextField
          label="Punto de venta"
          value={salesPoint}
          onChangeText={setSalesPoint}
          keyboardType="number-pad"
        />
        <OptionGroup<VoucherConceptType>
          label="Concepto"
          value={concept}
          onChange={setConcept}
          options={[
            { label: 'Productos', value: VoucherConcept.PRODUCTS },
            { label: 'Servicios', value: VoucherConcept.SERVICES },
            { label: 'Ambos', value: VoucherConcept.PRODUCTS_AND_SERVICES },
          ]}
        />

        <OptionGroup<string>
          label="Moneda"
          value={currency}
          onChange={chooseCurrency}
          options={currencyOptions}
        />
        {currency !== LOCAL_CURRENCY ? (
          <TextField
            label="Cotización"
            value={exchangeRate}
            onChangeText={setExchangeRate}
            keyboardType="decimal-pad"
            placeholder={exchangeRateLookup.isPending ? 'Consultando a ARCA…' : ''}
          />
        ) : null}

        {needsServicePeriod ? (
          <Card>
            <Label>Período facturado</Label>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Desde"
                  value={servicePeriod.from}
                  onChangeText={(v) => setServicePeriod((prev) => ({ ...prev, from: v }))}
                  placeholder="AAAA-MM-DD"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Hasta"
                  value={servicePeriod.to}
                  onChangeText={(v) => setServicePeriod((prev) => ({ ...prev, to: v }))}
                  placeholder="AAAA-MM-DD"
                />
              </View>
            </View>
          </Card>
        ) : null}

        {needsPaymentDueDate ? (
          <TextField
            label="Vencimiento de pago"
            value={paymentDueDate}
            onChangeText={setPaymentDueDate}
            placeholder="AAAA-MM-DD"
          />
        ) : null}

        {isCreditInvoice(voucherType) ? (
          <OptionGroup<TransmissionTypeName>
            label="Tipo de transmisión"
            value={transmissionType}
            onChange={setTransmissionType}
            options={[
              {
                label: transmissionTypeLabel[TransmissionType.OPEN_CIRCULATION],
                value: TransmissionType.OPEN_CIRCULATION,
              },
              {
                label: transmissionTypeLabel[TransmissionType.COLLECTIVE_DEPOSIT],
                value: TransmissionType.COLLECTIVE_DEPOSIT,
              },
            ]}
          />
        ) : null}

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
            onChangeText={(v) => {
              setDocNumber(v);
              setRecipientIvaConditionId(null);
            }}
            keyboardType="number-pad"
          />
          {docType === DocumentType.CUIT ? (
            <Button
              title="Buscar en padrón ARCA"
              variant="secondary"
              onPress={() => padronLookup.mutate()}
              loading={padronLookup.isPending}
            />
          ) : null}
          <TextField
            label="Razón social"
            value={legalName}
            onChangeText={setLegalName}
            placeholder="Opcional"
          />
          {recipientIvaConditionId !== null ? (
            <Badge
              text={`Padrón: ${recipientIvaConditionName[recipientIvaConditionId] ?? 'condición desconocida'}`}
              tone="ok"
            />
          ) : null}
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
            <OptionGroup<TaxTreatmentType>
              label="Tratamiento"
              value={item.taxTreatment}
              onChange={(v) =>
                setItem(index, {
                  taxTreatment: v,
                  ivaRate: v === TaxTreatment.TAXED ? DEFAULT_IVA_RATE : NO_IVA_RATE,
                })
              }
              options={[
                { label: taxTreatmentName.TAXED, value: TaxTreatment.TAXED },
                { label: taxTreatmentName.EXEMPT, value: TaxTreatment.EXEMPT },
                { label: taxTreatmentName.UNTAXED, value: TaxTreatment.UNTAXED },
              ]}
            />
            {item.taxTreatment === TaxTreatment.TAXED ? (
              <OptionGroup<number>
                label="IVA %"
                value={item.ivaRate}
                onChange={(v) => setItem(index, { ivaRate: v })}
                options={ivaRates.map((rate) => ({ label: `${rate}%`, value: rate }))}
              />
            ) : null}
          </Card>
        ))}
        <Button title="+ Agregar ítem" variant="secondary" onPress={() => setItems((prev) => [...prev, newItem()])} />

        <Label>Tributos</Label>
        {tributes.map((tribute, index) => (
          <Card key={index}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <BodyText>Tributo {index + 1}</BodyText>
              <Pressable
                onPress={() => setTributes((prev) => prev.filter((_, idx) => idx !== index))}
                hitSlop={8}
              >
                <Text style={{ color: '#E5484D', fontWeight: '600' }}>Quitar</Text>
              </Pressable>
            </View>
            <OptionGroup<number>
              label="Tipo"
              value={tribute.id}
              onChange={(v) => setTribute(index, { id: v })}
              options={[
                { label: tributeTypeName[TributeType.PROVINCIAL], value: TributeType.PROVINCIAL },
                { label: tributeTypeName[TributeType.MUNICIPAL], value: TributeType.MUNICIPAL },
                { label: tributeTypeName[TributeType.INTERNAL], value: TributeType.INTERNAL },
              ]}
            />
            <TextField
              label="Descripción"
              value={tribute.description}
              onChangeText={(v) => setTribute(index, { description: v })}
              placeholder="Percepción IIBB CABA"
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Base imponible"
                  value={tribute.taxableBase}
                  onChangeText={(v) => setTribute(index, { taxableBase: v })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Alícuota %"
                  value={tribute.rate}
                  onChangeText={(v) => setTribute(index, { rate: v })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </Card>
        ))}
        <Button
          title="+ Agregar tributo"
          variant="secondary"
          onPress={() => setTributes((prev) => [...prev, newTribute()])}
        />

        <Card>
          <Row label="Neto" value={formatCurrency(totals.net)} />
          {totals.untaxed > 0 ? (
            <Row label="No gravado" value={formatCurrency(totals.untaxed)} />
          ) : null}
          {totals.exempt > 0 ? (
            <Row label="Exento" value={formatCurrency(totals.exempt)} />
          ) : null}
          <Row label="IVA" value={formatCurrency(totals.iva)} />
          {totals.tributeAmount > 0 ? (
            <Row label="Tributos" value={formatCurrency(totals.tributeAmount)} />
          ) : null}
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
