import { voucherLetter } from './voucher-type';

export const RecipientIvaCondition = {
  RESPONSABLE_INSCRIPTO: 1,
  SUJETO_EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
  MONOTRIBUTISTA_SOCIAL: 13,
} as const;

export const recipientIvaConditionName: Record<number, string> = {
  1: 'Responsable Inscripto',
  4: 'Sujeto Exento',
  5: 'Consumidor Final',
  6: 'Monotributo',
  13: 'Monotributista Social',
};

const LETTER_A = 'A';
const LETTER_B = 'B';
const LETTER_M = 'M';

const knownConditions: readonly number[] = Object.values(RecipientIvaCondition);

export function allowedRecipientIvaConditions(
  voucherType: number,
): readonly number[] {
  const letter = voucherLetter(voucherType);
  if (letter === LETTER_A || letter === LETTER_M) {
    return [RecipientIvaCondition.RESPONSABLE_INSCRIPTO];
  }
  if (letter === LETTER_B) {
    return knownConditions.filter(
      (condition) => condition !== RecipientIvaCondition.RESPONSABLE_INSCRIPTO,
    );
  }
  return knownConditions;
}

export function isRecipientIvaConditionAllowed(
  voucherType: number,
  conditionId: number,
): boolean {
  if (!knownConditions.includes(conditionId)) {
    return true;
  }
  return allowedRecipientIvaConditions(voucherType).includes(conditionId);
}
