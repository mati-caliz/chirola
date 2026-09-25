import {
  DocumentType,
  LOCAL_CURRENCY,
  TaxTreatment,
  taxTreatmentName,
  TransmissionType,
  transmissionTypeLabel,
  TributeType,
  VoucherConcept,
  VoucherType,
  draftAmountsSchema,
  type DraftAmountsInput,
  type Item,
  type TaxTreatmentType,
} from "@chirola/shared";
import { toIsoDate } from "@/lib/format";

export interface ItemForm {
  description: string;
  quantity: string;
  unitPrice: string;
  ivaRate: number;
  taxTreatment: TaxTreatmentType;
}

export interface TributeForm {
  id: number;
  description: string;
  taxableBase: string;
  rate: string;
}

export const DEFAULT_IVA_RATE = 21;
export const NO_IVA_RATE = 0;
export const SELECTABLE_CURRENCIES = [LOCAL_CURRENCY, "DOL", "EUR"];
export const CREDIT_NOTE_HINT = "Anula el comprobante original";

export const DEFAULT_INVOICE_TYPES = [VoucherType.FACTURA_B, VoucherType.FACTURA_A, VoucherType.FACTURA_C];

export const voucherTypeHint: Record<number, string> = {
  [VoucherType.FACTURA_A]: "Para responsables inscriptos (discrimina IVA)",
  [VoucherType.FACTURA_B]: "Para consumidores finales y monotributistas",
  [VoucherType.FACTURA_C]: "La tuya si sos monotributista",
  [VoucherType.FACTURA_M]: "Si ARCA todavía no te habilitó la A",
  [VoucherType.FCE_FACTURA_A]: "Crédito electrónico MiPyME, cobrás por CBU",
  [VoucherType.FCE_FACTURA_B]: "Crédito electrónico MiPyME, cobrás por CBU",
  [VoucherType.FCE_FACTURA_C]: "Crédito electrónico MiPyME, cobrás por CBU",
};

export const conceptOptions = [
  { value: VoucherConcept.PRODUCTS, label: "Productos" },
  { value: VoucherConcept.SERVICES, label: "Servicios" },
  { value: VoucherConcept.PRODUCTS_AND_SERVICES, label: "Ambos" },
];

export const docTypeOptions = [
  { value: DocumentType.CUIT, label: "CUIT" },
  { value: DocumentType.DNI, label: "DNI" },
  { value: DocumentType.CONSUMIDOR_FINAL, label: "Cons. Final" },
];

export const taxTreatmentOptions = [
  { value: TaxTreatment.TAXED, label: taxTreatmentName.TAXED },
  { value: TaxTreatment.EXEMPT, label: taxTreatmentName.EXEMPT },
  { value: TaxTreatment.UNTAXED, label: taxTreatmentName.UNTAXED },
];

export const transmissionOptions = [
  {
    value: TransmissionType.OPEN_CIRCULATION,
    label: transmissionTypeLabel[TransmissionType.OPEN_CIRCULATION],
  },
  {
    value: TransmissionType.COLLECTIVE_DEPOSIT,
    label: transmissionTypeLabel[TransmissionType.COLLECTIVE_DEPOSIT],
  },
];

export const newItem = (): ItemForm => ({
  description: "",
  quantity: "1",
  unitPrice: "",
  ivaRate: DEFAULT_IVA_RATE,
  taxTreatment: TaxTreatment.TAXED,
});

export const toItemForm = (item: Item): ItemForm => ({
  description: item.description,
  quantity: String(item.quantity),
  unitPrice: String(item.unitPrice),
  ivaRate: item.ivaRate,
  taxTreatment: item.taxTreatment,
});

export const newTribute = (): TributeForm => ({
  id: TributeType.PROVINCIAL,
  description: "",
  taxableBase: "",
  rate: "",
});

export const currentMonthPeriod = (): { from: string; to: string } => {
  const now = new Date();
  return {
    from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

export const todayIso = (): string => toIsoDate(new Date());

const toNumber = (value: string): number => (value.trim() === "" ? 0 : Number(value));

export function toDraftAmountsInput(
  voucherType: number,
  items: ItemForm[],
  tributes: TributeForm[],
): DraftAmountsInput | null {
  const parsed = draftAmountsSchema.safeParse({
    voucherType,
    items: items.map((item) => ({
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      ivaRate: item.ivaRate,
      taxTreatment: item.taxTreatment,
    })),
    tributes: tributes.map((tribute) => ({
      id: tribute.id,
      taxableBase: toNumber(tribute.taxableBase),
      rate: toNumber(tribute.rate),
    })),
  });
  return parsed.success ? parsed.data : null;
}
