import { z } from "zod";
import { RecipientIvaCondition } from "./recipient-iva-condition";

export const ArcaTaxId = {
  VAT: 30,
  MONOTRIBUTO: 20,
  VAT_EXEMPT: 32,
} as const;

export const TaxpayerStatus = {
  ACTIVE: "ACTIVO",
  INACTIVE: "INACTIVO",
} as const;

export const taxpayerAddressSchema = z.object({
  street: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  province: z.string().nullable(),
});

export type TaxpayerAddress = z.infer<typeof taxpayerAddressSchema>;

export const taxpayerInfoSchema = z.object({
  cuit: z.string(),
  legalName: z.string(),
  status: z.string(),
  ivaConditionId: z.number(),
  address: taxpayerAddressSchema.nullable(),
});

export type TaxpayerInfo = z.infer<typeof taxpayerInfoSchema>;

export function inferRecipientIvaCondition(padron: {
  taxIds: readonly number[];
  hasMonotributo: boolean;
}): number {
  if (padron.hasMonotributo || padron.taxIds.includes(ArcaTaxId.MONOTRIBUTO)) {
    return RecipientIvaCondition.MONOTRIBUTO;
  }
  if (padron.taxIds.includes(ArcaTaxId.VAT)) {
    return RecipientIvaCondition.RESPONSABLE_INSCRIPTO;
  }
  if (padron.taxIds.includes(ArcaTaxId.VAT_EXEMPT)) {
    return RecipientIvaCondition.SUJETO_EXENTO;
  }
  return RecipientIvaCondition.CONSUMIDOR_FINAL;
}
