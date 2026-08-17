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
