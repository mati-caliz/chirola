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
  FACTURA_M: 51,
  NOTA_DEBITO_M: 52,
  NOTA_CREDITO_M: 53,
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
  51: 'Factura M',
  52: 'Nota de Débito M',
  53: 'Nota de Crédito M',
};

const typesRequiringCuit: readonly number[] = [
  VoucherType.FACTURA_A,
  VoucherType.NOTA_DEBITO_A,
  VoucherType.NOTA_CREDITO_A,
  VoucherType.FACTURA_M,
  VoucherType.NOTA_DEBITO_M,
  VoucherType.NOTA_CREDITO_M,
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
  VoucherType.NOTA_DEBITO_M,
  VoucherType.NOTA_CREDITO_M,
];

export function isCreditDebitNote(voucherType: number): boolean {
  return creditDebitNoteTypes.includes(voucherType);
}

const creditNoteTypes: readonly number[] = [
  VoucherType.NOTA_CREDITO_A,
  VoucherType.NOTA_CREDITO_B,
  VoucherType.NOTA_CREDITO_C,
  VoucherType.NOTA_CREDITO_M,
];

export function isCreditNote(voucherType: number): boolean {
  return creditNoteTypes.includes(voucherType);
}

export function voucherLetter(voucherType: number): string {
  const name = voucherTypeName[voucherType] ?? '';
  const match = name.match(/ ([ABCM])$/);
  return match ? match[1] : '';
}

const ivaDiscriminatingLetters: readonly string[] = ['A', 'M'];

export function discriminatesIva(voucherType: number): boolean {
  return ivaDiscriminatingLetters.includes(voucherLetter(voucherType));
}

const retentionAgentTypes: readonly number[] = [
  VoucherType.FACTURA_M,
  VoucherType.NOTA_DEBITO_M,
  VoucherType.NOTA_CREDITO_M,
];

export function requiresRetentionNotice(voucherType: number): boolean {
  return retentionAgentTypes.includes(voucherType);
}

export const issuableInvoiceTypes: readonly number[] = [
  VoucherType.FACTURA_A,
  VoucherType.FACTURA_B,
  VoucherType.FACTURA_C,
  VoucherType.FACTURA_M,
];
