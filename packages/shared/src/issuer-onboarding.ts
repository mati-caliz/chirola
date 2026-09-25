export const IssuerOnboardingStatus = {
  PENDING_CERTIFICATE: "PENDING_CERTIFICATE",
  PENDING_DELEGATION: "PENDING_DELEGATION",
  DELEGATION_CONFIRMED: "DELEGATION_CONFIRMED",
  ISSUING_CONFIRMED: "ISSUING_CONFIRMED",
  BLOCKED_BY_ARCA: "BLOCKED_BY_ARCA",
} as const;

export type IssuerOnboardingStatusName = (typeof IssuerOnboardingStatus)[keyof typeof IssuerOnboardingStatus];

export const issuerOnboardingStatusName: Record<IssuerOnboardingStatusName, string> = {
  PENDING_CERTIFICATE: "Falta cargar el certificado",
  PENDING_DELEGATION: "Falta autorizar el servicio en ARCA",
  DELEGATION_CONFIRMED: "Autorización verificada, todavía sin facturar",
  ISSUING_CONFIRMED: "Facturando",
  BLOCKED_BY_ARCA: "ARCA rechaza al contribuyente",
};

export function describeIssuerOnboardingStatus(status: string): string {
  const known = Object.entries(issuerOnboardingStatusName).find(([key]) => key === status);
  return known ? known[1] : status;
}

const STATUSES_REACHED_THROUGH_ARCA: readonly IssuerOnboardingStatusName[] = [
  IssuerOnboardingStatus.DELEGATION_CONFIRMED,
  IssuerOnboardingStatus.ISSUING_CONFIRMED,
  IssuerOnboardingStatus.BLOCKED_BY_ARCA,
];

export function hasConfirmedDelegation(status: string): boolean {
  return (STATUSES_REACHED_THROUGH_ARCA as readonly string[]).includes(status);
}
