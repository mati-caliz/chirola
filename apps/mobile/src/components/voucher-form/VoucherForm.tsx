import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArcaParamType,
  discriminatesIva,
  DocumentType,
  isCreditInvoice,
  issuableInvoiceTypes,
  issueVoucherSchema,
  LOCAL_CURRENCY,
  LOCAL_EXCHANGE_RATE,
  requiresRecipientCuit,
  requiresServicePeriod,
  TransmissionType,
  VoucherConcept,
  VoucherType,
  voucherTypeName,
  type IssueVoucher,
  type TransmissionTypeName,
  type VoucherConceptType,
} from '@chirola/shared';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, BottomSheet, Button, Input, ListItem, Segmented, Select } from '@/components/ds';
import { ArcaHealthBanner } from '@/components/vouchers/ArcaHealthBanner';
import { ConfirmEmissionSheet } from '@/components/vouchers/ConfirmEmissionSheet';
import { QueuedEmissionScreen } from '@/components/vouchers/QueuedEmissionScreen';
import { pendingVouchersQueryKey } from '@/components/vouchers/PendingVouchersSection';
import { ApiError } from '@/lib/api';
import {
  dryRunVoucher,
  getExchangeRate,
  issueVoucher,
  listArcaParams,
  listClients,
  listCurrencies,
  listSalesPoints,
  lookupTaxpayer,
  type Client,
} from '@/lib/resources';
import {
  conceptOptions,
  CREDIT_NOTE_HINT,
  currentMonthPeriod,
  DEFAULT_INVOICE_TYPES,
  newItem,
  newTribute,
  SELECTABLE_CURRENCIES,
  toDraftAmountsInput,
  todayIso,
  toItemForm,
  voucherTypeHint,
  type ItemForm,
  type TributeForm,
} from './form-model';
import { RecipientSection } from './RecipientSection';
import { BillingDatesSection } from './BillingDatesSection';
import { ItemCard } from './ItemCard';
import { TributeCard } from './TributeCard';
import { TotalsFooter } from './TotalsFooter';
import { EmittingScreen, FailedEmissionScreen } from './EmissionStatusScreens';
import { useTheme } from '@/hooks/use-theme';

const HTTP_SERVICE_UNAVAILABLE = 503;
const SALES_POINT_DIGITS = 4;
const INVALID_FORM_MESSAGE = 'Revisá los datos de la factura.';

type SheetName = 'tipo' | 'pdv' | 'moneda' | 'confirm';

const replaceAt = <T,>(list: T[], index: number, patch: Partial<T>): T[] =>
  list.map((entry, position) => (position === index ? { ...entry, ...patch } : entry));

const removeAt = <T,>(list: T[], index: number): T[] =>
  list.filter((_, position) => position !== index);

export function VoucherForm({ issuerId, draft }: { issuerId: string; draft: IssueVoucher | null }) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [voucherType, setVoucherType] = useState<number>(draft?.voucherType ?? VoucherType.FACTURA_B);
  const [salesPoint, setSalesPoint] = useState(draft ? String(draft.salesPoint) : '1');
  const [concept, setConcept] = useState<VoucherConceptType>(draft?.concept ?? VoucherConcept.PRODUCTS);
  const [servicePeriod, setServicePeriod] = useState(() => draft?.servicePeriod ?? currentMonthPeriod());
  const [paymentDueDate, setPaymentDueDate] = useState(() => draft?.paymentDueDate ?? todayIso());
  const [transmissionType, setTransmissionType] = useState<TransmissionTypeName>(
    TransmissionType.OPEN_CIRCULATION,
  );
  const [docType, setDocType] = useState<number>(draft?.recipient.docType ?? DocumentType.CONSUMIDOR_FINAL);
  const [docNumber, setDocNumber] = useState(draft?.recipient.docNumber ?? '0');
  const [legalName, setLegalName] = useState(draft?.recipient.legalName ?? '');
  const [recipientIvaConditionId, setRecipientIvaConditionId] = useState<number | null>(null);
  const [currency, setCurrency] = useState(draft?.currency ?? LOCAL_CURRENCY);
  const [exchangeRate, setExchangeRate] = useState(String(draft?.exchangeRate ?? LOCAL_EXCHANGE_RATE));
  const [items, setItems] = useState<ItemForm[]>(() => (draft ? draft.items.map(toItemForm) : [newItem()]));
  const [tributes, setTributes] = useState<TributeForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [sheet, setSheet] = useState<SheetName | null>(null);

  const { data: clients } = useQuery({ queryKey: ['clients', issuerId], queryFn: () => listClients(issuerId) });
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
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['vouchers', issuerId] });
      router.replace(`/(app)/vouchers/${res.id}`);
    },
    onError: (e) => {
      setSheet(null);
      if (e instanceof ApiError && e.status === HTTP_SERVICE_UNAVAILABLE) {
        void queryClient.invalidateQueries({ queryKey: pendingVouchersQueryKey(issuerId) });
        setQueued(true);
        return;
      }
      setError(e instanceof Error ? e.message : 'No se pudo emitir el comprobante.');
    },
  });

  const emissionPlan = useMutation({ mutationFn: dryRunVoucher });

  const exchangeRateLookup = useMutation({
    mutationFn: (currencyId: string) => getExchangeRate(issuerId, currencyId),
    onSuccess: (quote) => setExchangeRate(String(quote.rate)),
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo traer la cotización.'),
  });

  const padronLookup = useMutation({
    mutationFn: () => lookupTaxpayer(issuerId, docNumber.trim()),
    onSuccess: (taxpayer) => {
      setLegalName(taxpayer.legalName);
      setRecipientIvaConditionId(taxpayer.ivaConditionId);
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo consultar el padrón.'),
  });

  const voucherTypeOptions = useMemo(() => {
    if (draft) {
      return [{ value: draft.voucherType, label: voucherTypeName[draft.voucherType], hint: CREDIT_NOTE_HINT }];
    }
    const enabledIds = new Set((enabledVoucherTypes ?? []).map((param) => param.id));
    const available = issuableInvoiceTypes.filter((type) => enabledIds.has(type));
    const types = available.length > 0 ? available : DEFAULT_INVOICE_TYPES;
    return types.map((type) => ({ value: type, label: voucherTypeName[type], hint: voucherTypeHint[type] }));
  }, [enabledVoucherTypes, draft]);

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

  const amountsInput = useMemo(
    () => toDraftAmountsInput(voucherType, items, tributes),
    [voucherType, items, tributes],
  );

  const needsServicePeriod = requiresServicePeriod(concept);
  const isFce = isCreditInvoice(voucherType);
  const needsPaymentDueDate = needsServicePeriod || isFce;

  const selectedType = voucherTypeOptions.find((type) => type.value === voucherType);
  const selectedSalesPoint = salesPoints?.find((point) => String(point.number) === salesPoint);
  const salesPointLabel = selectedSalesPoint
    ? `${String(selectedSalesPoint.number).padStart(SALES_POINT_DIGITS, '0')}${selectedSalesPoint.description ? ` — ${selectedSalesPoint.description}` : ''}`
    : undefined;
  const selectedCurrency = currencyOptions.find((option) => option.value === currency);
  const clientLabel =
    legalName.trim() || (docType === DocumentType.CONSUMIDOR_FINAL ? 'Consumidor final' : docNumber);

  const parsePayload = () =>
    issueVoucherSchema.safeParse({
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
      associatedVouchers: draft?.associatedVouchers,
      currency,
      exchangeRate: Number(exchangeRate),
    });

  const review = () => {
    setError(null);
    const parsed = parsePayload();
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? INVALID_FORM_MESSAGE);
      return;
    }
    emissionPlan.reset();
    emissionPlan.mutate(parsed.data);
    setSheet('confirm');
  };

  const emit = () => {
    const parsed = parsePayload();
    if (!parsed.success) {
      setSheet(null);
      setError(parsed.error.issues[0]?.message ?? INVALID_FORM_MESSAGE);
      return;
    }
    mutation.mutate(parsed.data);
  };

  if (queued) {
    return (
      <QueuedEmissionScreen
        onSeeVouchers={() => router.replace('/(app)/(tabs)/comprobantes')}
        onExit={() => router.back()}
      />
    );
  }
  if (mutation.isPending) {
    return <EmittingScreen />;
  }
  if (error) {
    return <FailedEmissionScreen message={error} onRetry={() => setError(null)} onExit={() => router.back()} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['bottom']}>
      <Stack.Screen options={{ title: draft ? 'Nota de crédito' : 'Emitir comprobante' }} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
        <ArcaHealthBanner issuerId={issuerId} />
        {draft ? (
          <Banner
            kind="info"
            title="Anulás un comprobante con esta nota de crédito"
            body="Los datos vienen del original. Si la anulación es parcial, ajustá los ítems antes de emitir."
          />
        ) : null}
        <Select label="Tipo de comprobante" value={selectedType?.label} hint={selectedType?.hint} onPress={() => setSheet('tipo')} />
        {salesPoints && salesPoints.length > 0 ? (
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
            hint={exchangeRateLookup.isPending ? 'Consultando a ARCA…' : 'ARCA valida contra su propia cotización.'}
          />
        ) : null}

        <RecipientSection
          clients={clients}
          voucherType={voucherType}
          requiresCuit={requiresRecipientCuit(voucherType)}
          docType={docType}
          docNumber={docNumber}
          legalName={legalName}
          ivaConditionId={recipientIvaConditionId}
          padronPending={padronLookup.isPending}
          onChooseClient={chooseClient}
          onDocTypeChange={setDocType}
          onDocNumberChange={setDocNumber}
          onLegalNameChange={setLegalName}
          onPadronLookup={() => padronLookup.mutate()}
        />

        <Segmented value={concept} options={conceptOptions} onChange={setConcept} label="Concepto" />

        <BillingDatesSection
          needsServicePeriod={needsServicePeriod}
          needsPaymentDueDate={needsPaymentDueDate}
          isFce={isFce}
          servicePeriod={servicePeriod}
          paymentDueDate={paymentDueDate}
          transmissionType={transmissionType}
          onServicePeriodChange={setServicePeriod}
          onPaymentDueDateChange={setPaymentDueDate}
          onTransmissionTypeChange={setTransmissionType}
        />

        {items.map((item, index) => (
          <ItemCard
            key={index}
            item={item}
            position={index + 1}
            discriminatesIva={discriminatesIva(voucherType)}
            canRemove={items.length > 1}
            onChange={(patch) => setItems((prev) => replaceAt(prev, index, patch))}
            onRemove={() => setItems((prev) => removeAt(prev, index))}
          />
        ))}
        <Button variant="ghost" full onPress={() => setItems((prev) => [...prev, newItem()])}>
          + Agregar otro ítem
        </Button>

        {tributes.map((tribute, index) => (
          <TributeCard
            key={`tribute-${index}`}
            tribute={tribute}
            onChange={(patch) => setTributes((prev) => replaceAt(prev, index, patch))}
            onRemove={() => setTributes((prev) => removeAt(prev, index))}
          />
        ))}
        <Button variant="ghost" full onPress={() => setTributes((prev) => [...prev, newTribute()])}>
          + Agregar percepción o tributo
        </Button>
      </ScrollView>

      <TotalsFooter
        amountsInput={amountsInput}
        currency={currency}
        onReview={review}
      />

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
            title={`Punto de venta ${String(point.number).padStart(SALES_POINT_DIGITS, '0')}`}
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
          <ListItem key={option.value} title={option.label} subtitle={option.value} onPress={() => chooseCurrency(option.value)} />
        ))}
      </BottomSheet>

      <ConfirmEmissionSheet
        open={sheet === 'confirm'}
        typeLabel={selectedType?.label}
        clientLabel={clientLabel}
        currency={currency}
        plan={emissionPlan.data}
        planLoading={emissionPlan.isPending}
        planError={emissionPlan.error?.message ?? null}
        onClose={() => setSheet(null)}
        onConfirm={emit}
      />
    </SafeAreaView>
  );
}
