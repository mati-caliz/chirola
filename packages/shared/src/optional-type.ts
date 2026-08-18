export const ArcaOptionalType = {
  CANCELLATION: 22,
  TRANSMISSION_TYPE: 27,
  CBU: 2101,
  PAYMENT_ALIAS: 2102,
} as const;

export const arcaOptionalTypeName: Record<number, string> = {
  22: 'Anulación',
  27: 'Tipo de transmisión',
  2101: 'CBU del emisor',
  2102: 'Alias del emisor',
};

export const TransmissionType = {
  OPEN_CIRCULATION: 'SCA',
  COLLECTIVE_DEPOSIT: 'ADC',
} as const;

export type TransmissionTypeName =
  (typeof TransmissionType)[keyof typeof TransmissionType];

export const transmissionTypeLabel: Record<TransmissionTypeName, string> = {
  SCA: 'Sistema de circulación abierta',
  ADC: 'Agente de depósito colectivo',
};

export const CANCELLATION_YES = 'S';
export const CANCELLATION_NO = 'N';
