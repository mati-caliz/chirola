import { z } from "zod";
import { TaxTreatment, type TaxTreatmentType } from "@chirola/shared";

const storedTaxTreatmentSchema = z.enum([TaxTreatment.TAXED, TaxTreatment.EXEMPT, TaxTreatment.UNTAXED]);

export function parseTaxTreatment(stored: string): TaxTreatmentType {
  const parsed = storedTaxTreatmentSchema.safeParse(stored);
  return parsed.success ? parsed.data : TaxTreatment.TAXED;
}
