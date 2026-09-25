import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArcaParamType,
  DocumentType,
  issuableInvoiceTypes,
  LOCAL_CURRENCY,
  voucherTypeName,
  hasText,
  type ArcaParam,
  type IssueVoucher,
  type Client,
  type Currency,
  type SalesPoint,
} from "@chirola/shared";
import { listArcaParams, listClients, listCurrencies, listSalesPoints } from "@/lib/resources";
import {
  CREDIT_NOTE_HINT,
  DEFAULT_INVOICE_TYPES,
  SELECTABLE_CURRENCIES,
  voucherTypeHint,
} from "./form-model";

const SALES_POINT_DIGITS = 4;
const LOCAL_CURRENCY_LABEL = "Pesos";
const CONSUMIDOR_FINAL_LABEL = "Consumidor final";

export interface VoucherTypeOption {
  value: number;
  label: string;
  hint?: string;
}

export interface CurrencyOption {
  value: string;
  label: string;
}

export const padSalesPoint = (salesPointNumber: number): string =>
  String(salesPointNumber).padStart(SALES_POINT_DIGITS, "0");

export function salesPointLabel(point: SalesPoint | undefined): string | undefined {
  if (point === undefined) return undefined;
  const paddedNumber = padSalesPoint(point.number);
  return hasText(point.description) ? `${paddedNumber} — ${point.description}` : paddedNumber;
}

export function recipientLabel(legalName: string, docType: number, docNumber: string): string {
  const trimmedName = legalName.trim();
  if (trimmedName !== "") return trimmedName;
  return docType === DocumentType.CONSUMIDOR_FINAL ? CONSUMIDOR_FINAL_LABEL : docNumber;
}

const typeLabel = (type: number): string => voucherTypeName[type] ?? String(type);

function invoiceTypeOption(type: number): VoucherTypeOption {
  const hint = voucherTypeHint[type];
  return hasText(hint)
    ? { value: type, label: typeLabel(type), hint }
    : { value: type, label: typeLabel(type) };
}

export function buildVoucherTypeOptions(
  draft: IssueVoucher | null,
  enabledVoucherTypes: ArcaParam[] | undefined,
): VoucherTypeOption[] {
  if (draft !== null) {
    return [{ value: draft.voucherType, label: typeLabel(draft.voucherType), hint: CREDIT_NOTE_HINT }];
  }
  const enabledIds = new Set((enabledVoucherTypes ?? []).map((param) => param.id));
  const available = issuableInvoiceTypes.filter((type) => enabledIds.has(type));
  const types = available.length > 0 ? available : DEFAULT_INVOICE_TYPES;
  return types.map(invoiceTypeOption);
}

export function buildCurrencyOptions(currencies: Currency[] | undefined): CurrencyOption[] {
  const descriptionById = new Map((currencies ?? []).map((item) => [item.id, item.description]));
  return SELECTABLE_CURRENCIES.map((id) => ({
    value: id,
    label: id === LOCAL_CURRENCY ? LOCAL_CURRENCY_LABEL : (descriptionById.get(id) ?? id),
  }));
}

export interface VoucherFormOptions {
  clients: Client[] | undefined;
  salesPoints: SalesPoint[] | undefined;
  voucherTypeOptions: VoucherTypeOption[];
  currencyOptions: CurrencyOption[];
}

interface VoucherFormOptionsInput {
  issuerId: string;
  draft: IssueVoucher | null;
  voucherType: number;
  setVoucherType: Dispatch<SetStateAction<number>>;
}

export function useVoucherFormOptions({
  issuerId,
  draft,
  voucherType,
  setVoucherType,
}: VoucherFormOptionsInput): VoucherFormOptions {
  const { data: clients } = useQuery({
    queryKey: ["clients", issuerId],
    queryFn: () => listClients(issuerId),
  });
  const { data: salesPoints } = useQuery({
    queryKey: ["sales-points", issuerId],
    queryFn: () => listSalesPoints(issuerId),
  });
  const { data: enabledVoucherTypes } = useQuery({
    queryKey: ["params", issuerId, ArcaParamType.VOUCHER_TYPES],
    queryFn: () => listArcaParams(issuerId, ArcaParamType.VOUCHER_TYPES),
  });
  const { data: currencies } = useQuery({
    queryKey: ["currencies", issuerId],
    queryFn: () => listCurrencies(issuerId),
  });

  const voucherTypeOptions = useMemo(
    () => buildVoucherTypeOptions(draft, enabledVoucherTypes),
    [enabledVoucherTypes, draft],
  );

  useEffect(() => {
    if (!voucherTypeOptions.some((option) => option.value === voucherType)) {
      const firstOption = voucherTypeOptions[0];
      if (firstOption !== undefined) {
        setVoucherType(firstOption.value);
      }
    }
  }, [voucherTypeOptions, voucherType, setVoucherType]);

  const currencyOptions = useMemo(() => buildCurrencyOptions(currencies), [currencies]);

  return { clients, salesPoints, voucherTypeOptions, currencyOptions };
}
