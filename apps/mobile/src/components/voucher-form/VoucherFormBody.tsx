import { useMemo, type ReactNode } from "react";
import { ScrollView } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { requiresRecipientCuit, type IssueVoucher } from "@chirola/shared";
import { Banner, Segmented } from "@/components/ds";
import { ArcaHealthBanner } from "@/components/vouchers/ArcaHealthBanner";
import { useTheme } from "@/hooks/use-theme";
import { BillingDatesSection } from "./BillingDatesSection";
import { DocumentFields } from "./DocumentFields";
import { conceptOptions, toDraftAmountsInput } from "./form-model";
import { LineItemsSection } from "./LineItemsSection";
import { RecipientSection } from "./RecipientSection";
import { TotalsFooter } from "./TotalsFooter";
import type { VoucherEmission } from "./use-voucher-emission";
import type { VoucherFormOptions } from "./use-voucher-form-options";
import type { VoucherFormState } from "./use-voucher-form-state";
import { VoucherFormSheets } from "./VoucherFormSheets";
import { billingRequirements } from "./voucher-payload";

export interface VoucherFormBodyProps {
  issuerId: string;
  draft: IssueVoucher | null;
  form: VoucherFormState;
  options: VoucherFormOptions;
  emission: VoucherEmission;
}

const RecipientFields = ({ form, options, emission }: VoucherFormBodyProps): ReactNode => {
  const { values, setters } = form;
  return (
    <RecipientSection
      clients={options.clients}
      voucherType={values.voucherType}
      requiresCuit={requiresRecipientCuit(values.voucherType)}
      docType={values.docType}
      docNumber={values.docNumber}
      legalName={values.legalName}
      ivaConditionId={values.recipientIvaConditionId}
      padronPending={emission.padronPending}
      onChooseClient={(client) => {
        setters.setDocType(client.docType);
        setters.setDocNumber(client.docNumber);
        setters.setLegalName(client.legalName ?? "");
      }}
      onDocTypeChange={setters.setDocType}
      onDocNumberChange={setters.setDocNumber}
      onLegalNameChange={setters.setLegalName}
      onPadronLookup={emission.lookupPadron}
    />
  );
};

const BillingFields = ({ form }: Readonly<{ form: VoucherFormState }>): ReactNode => {
  const { values, setters } = form;
  const requirements = billingRequirements(values);
  return (
    <>
      <Segmented
        value={values.concept}
        options={conceptOptions}
        onChange={setters.setConcept}
        label="Concepto"
      />
      <BillingDatesSection
        needsServicePeriod={requirements.needsServicePeriod}
        needsPaymentDueDate={requirements.needsPaymentDueDate}
        isFce={requirements.isFce}
        servicePeriod={values.servicePeriod}
        paymentDueDate={values.paymentDueDate}
        transmissionType={values.transmissionType}
        onServicePeriodChange={setters.setServicePeriod}
        onPaymentDueDateChange={setters.setPaymentDueDate}
        onTransmissionTypeChange={setters.setTransmissionType}
      />
    </>
  );
};

export const VoucherFormBody = (props: VoucherFormBodyProps): ReactNode => {
  const { issuerId, draft, form, options, emission } = props;
  const theme = useTheme();
  const { voucherType, items, tributes, currency } = form.values;
  const amountsInput = useMemo(
    () => toDraftAmountsInput(voucherType, items, tributes),
    [voucherType, items, tributes],
  );
  const isCreditNote = draft !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["bottom"]}>
      <Stack.Screen options={{ title: isCreditNote ? "Nota de crédito" : "Emitir comprobante" }} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
        <ArcaHealthBanner issuerId={issuerId} />
        {isCreditNote ? (
          <Banner
            kind="info"
            title="Anulás un comprobante con esta nota de crédito"
            body="Los datos vienen del original. Si la anulación es parcial, ajustá los ítems antes de emitir."
          />
        ) : null}
        <DocumentFields form={form} options={options} emission={emission} />
        <RecipientFields {...props} />
        <BillingFields form={form} />
        <LineItemsSection form={form} />
      </ScrollView>

      <TotalsFooter amountsInput={amountsInput} currency={currency} onReview={emission.review} />

      <VoucherFormSheets form={form} options={options} emission={emission} />
    </SafeAreaView>
  );
};
