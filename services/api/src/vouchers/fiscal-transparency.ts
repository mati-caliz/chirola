import { isNationalIndirectTribute, requiresFiscalTransparencyNotice, type Item } from "@chirola/shared";
import { containedIvaAmount } from "../arca/wsfe/iva-calculator";
import type { FiscalTransparencyPdf } from "./pdf.util";

export interface TypedTributeAmount {
  id?: number;
  amount: number;
}

export interface FiscalTransparencySource {
  voucherType: number;
  ivaAmount: number;
  items: Pick<Item, "quantity" | "unitPrice" | "ivaRate" | "taxTreatment">[];
  tributes: TypedTributeAmount[];
}

const CENTS_PER_UNIT = 100;

const roundToCents = (amount: number): number =>
  Math.round((amount + Number.EPSILON) * CENTS_PER_UNIT) / CENTS_PER_UNIT;

export function buildFiscalTransparency(source: FiscalTransparencySource): FiscalTransparencyPdf | null {
  if (!requiresFiscalTransparencyNotice(source.voucherType)) return null;
  const containedIva = source.ivaAmount > 0 ? source.ivaAmount : containedIvaAmount(source.items);
  const otherNationalIndirectTaxes = roundToCents(
    source.tributes
      .filter((tribute) => tribute.id !== undefined && isNationalIndirectTribute(tribute.id))
      .reduce((total, tribute) => total + tribute.amount, 0),
  );
  return { containedIva, otherNationalIndirectTaxes };
}
