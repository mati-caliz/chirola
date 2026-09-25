import {
  isCreditInvoice,
  issueVoucherSchema,
  requiresServicePeriod,
  type IssueVoucher,
} from "@chirola/shared";
import type { ItemForm, TributeForm } from "./form-model";
import type { VoucherFormValues } from "./use-voucher-form-state";

export interface BillingRequirements {
  needsServicePeriod: boolean;
  isFce: boolean;
  needsPaymentDueDate: boolean;
}

export function billingRequirements(
  values: Pick<VoucherFormValues, "concept" | "voucherType">,
): BillingRequirements {
  const needsServicePeriod = requiresServicePeriod(values.concept);
  const isFce = isCreditInvoice(values.voucherType);
  return { needsServicePeriod, isFce, needsPaymentDueDate: needsServicePeriod || isFce };
}

const emptyToUndefined = (value: string): string | undefined => (value === "" ? undefined : value);

const recipientPayload = (values: VoucherFormValues): Record<string, unknown> => ({
  docType: values.docType,
  docNumber: values.docNumber.trim(),
  legalName: emptyToUndefined(values.legalName.trim()),
  ivaConditionId: values.recipientIvaConditionId ?? undefined,
});

const itemsPayload = (items: ItemForm[]): Record<string, unknown>[] =>
  items.map((item) => ({
    description: item.description.trim(),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    ivaRate: item.ivaRate,
    taxTreatment: item.taxTreatment,
  }));

const tributesPayload = (tributes: TributeForm[]): Record<string, unknown>[] | undefined => {
  if (tributes.length === 0) return undefined;
  return tributes.map((tribute) => ({
    id: tribute.id,
    description: tribute.description.trim(),
    taxableBase: Number(tribute.taxableBase),
    rate: Number(tribute.rate),
  }));
};

const billingPayload = (values: VoucherFormValues): Record<string, unknown> => {
  const requirements = billingRequirements(values);
  return {
    servicePeriod: requirements.needsServicePeriod ? values.servicePeriod : undefined,
    paymentDueDate: requirements.needsPaymentDueDate ? values.paymentDueDate : undefined,
    transmissionType: requirements.isFce ? values.transmissionType : undefined,
  };
};

export interface VoucherPayloadSource {
  issuerId: string;
  draft: IssueVoucher | null;
  values: VoucherFormValues;
}

export type ParsedVoucherPayload = ReturnType<typeof issueVoucherSchema.safeParse>;

export function parseVoucherPayload({ issuerId, draft, values }: VoucherPayloadSource): ParsedVoucherPayload {
  return issueVoucherSchema.safeParse({
    issuerId,
    salesPoint: Number(values.salesPoint),
    voucherType: values.voucherType,
    concept: values.concept,
    recipient: recipientPayload(values),
    items: itemsPayload(values.items),
    tributes: tributesPayload(values.tributes),
    ...billingPayload(values),
    associatedVouchers: draft?.associatedVouchers,
    currency: values.currency,
    exchangeRate: Number(values.exchangeRate),
  });
}
