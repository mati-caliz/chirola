export const VoucherType = {
  FACTURA_A: 1,
  NOTA_DEBITO_A: 2,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_B: 8,
  FACTURA_C: 11,
  NOTA_DEBITO_C: 12,
  NOTA_CREDITO_C: 13,
} as const;

export const voucherTypeName: Record<number, string> = {
  1: 'Factura A',
  2: 'Nota de Débito A',
  3: 'Nota de Crédito A',
  6: 'Factura B',
  7: 'Nota de Débito B',
  8: 'Nota de Crédito B',
  11: 'Factura C',
  12: 'Nota de Débito C',
  13: 'Nota de Crédito C',
};

const typesRequiringCuit: readonly number[] = [
  VoucherType.FACTURA_A,
  VoucherType.NOTA_DEBITO_A,
  VoucherType.NOTA_CREDITO_A,
];

export function requiresRecipientCuit(voucherType: number): boolean {
  return typesRequiringCuit.includes(voucherType);
}

const creditDebitNoteTypes: readonly number[] = [
  VoucherType.NOTA_DEBITO_A,
  VoucherType.NOTA_CREDITO_A,
  VoucherType.NOTA_DEBITO_B,
  VoucherType.NOTA_CREDITO_B,
  VoucherType.NOTA_DEBITO_C,
  VoucherType.NOTA_CREDITO_C,
];

export function isCreditDebitNote(voucherType: number): boolean {
  return creditDebitNoteTypes.includes(voucherType);
}

const creditNoteTypes: readonly number[] = [
  VoucherType.NOTA_CREDITO_A,
  VoucherType.NOTA_CREDITO_B,
  VoucherType.NOTA_CREDITO_C,
];

export function isCreditNote(voucherType: number): boolean {
  return creditNoteTypes.includes(voucherType);
}

export function voucherLetter(voucherType: number): string {
  const name = voucherTypeName[voucherType] ?? '';
  const match = name.match(/ ([ABC])$/);
  return match ? match[1] : '';
}
