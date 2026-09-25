import { hasText, VoucherStatus, type IssueVoucher, type Item } from "@chirola/shared";
import type { EmissionIssuer, EmissionOutcome } from "./voucher-emission.types";
import type { IssuedVoucherData, IssuedVoucherItemData } from "./voucher-tables";
import { optionalField } from "../common/optional-field";

const CENTS_PER_UNIT = 100;

export interface IssuedVoucherDataSource {
  issuer: EmissionIssuer;
  input: IssueVoucher;
  outcome: EmissionOutcome;
  salesPointId: string;
  client: { id: string; legalName: string | null } | null;
  qrData: string;
}

type ScheduleFields = Pick<IssuedVoucherData, "serviceFrom" | "serviceTo" | "paymentDueDate">;
type OptionalJsonFields = Pick<IssuedVoucherData, "tributes" | "arcaObservations" | "associatedVouchers">;

export function parseIsoDate(iso: string): Date {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function emittedStatus(outcome: EmissionOutcome): string {
  if (outcome.recovered) return VoucherStatus.RECOVERED;
  return outcome.cae.observations.length > 0 ? VoucherStatus.OBSERVED : VoucherStatus.APPROVED;
}

function scheduleFields(input: IssueVoucher): ScheduleFields {
  const { servicePeriod, paymentDueDate } = input;
  return {
    serviceFrom: servicePeriod ? parseIsoDate(servicePeriod.from) : null,
    serviceTo: servicePeriod ? parseIsoDate(servicePeriod.to) : null,
    paymentDueDate: hasText(paymentDueDate) ? parseIsoDate(paymentDueDate) : null,
  };
}

function optionalJsonFields({ input, outcome }: IssuedVoucherDataSource): OptionalJsonFields {
  const { tributes } = outcome.amounts;
  const { observations } = outcome.cae;
  return {
    ...(tributes.length > 0 ? { tributes } : {}),
    ...(observations.length > 0 ? { arcaObservations: observations } : {}),
    ...optionalField("associatedVouchers", input.associatedVouchers),
  };
}

function itemData(item: Item): IssuedVoucherItemData {
  return {
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    ivaRate: item.ivaRate,
    taxTreatment: item.taxTreatment,
    subtotal: Math.round(item.quantity * item.unitPrice * CENTS_PER_UNIT) / CENTS_PER_UNIT,
  };
}

export function buildIssuedVoucherData(source: IssuedVoucherDataSource): IssuedVoucherData {
  const { issuer, input, outcome, client } = source;
  const { cae, number, amounts, date } = outcome;
  return {
    issuerId: issuer.id,
    salesPointId: source.salesPointId,
    clientId: client?.id ?? null,
    recipientDocType: input.recipient.docType,
    recipientDocNumber: input.recipient.docNumber,
    recipientName: input.recipient.legalName ?? client?.legalName ?? null,
    voucherType: input.voucherType,
    number,
    voucherDate: date,
    concept: input.concept,
    ...scheduleFields(input),
    netAmount: amounts.netAmount,
    ivaAmount: amounts.ivaAmount,
    exemptAmount: amounts.exemptAmount,
    untaxedAmount: amounts.untaxedAmount,
    tributeAmount: amounts.tributeAmount,
    totalAmount: amounts.totalAmount,
    ...optionalJsonFields(source),
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    status: emittedStatus(outcome),
    cae: cae.cae,
    caeExpiration: cae.caeVto,
    qrData: source.qrData,
    items: { create: input.items.map(itemData) },
  };
}
