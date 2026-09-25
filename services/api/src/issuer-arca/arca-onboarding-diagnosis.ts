import { hasConfirmedDelegation } from "@chirola/shared";

const PENDING_DELEGATION_EXPLANATION =
  "ARCA todavía no reconoce una autorización para facturar en nombre de este " +
  "contribuyente. Hay que entrar a ARCA con clave fiscal, ir a Administrador de " +
  "Relaciones de Clave Fiscal y delegar el servicio de Facturación Electrónica al " +
  "certificado cargado. Si el trámite ya se hizo, el mismo error aparece cuando el " +
  "contribuyente está inhabilitado para facturar.";

const BLOCKED_TAXPAYER_EXPLANATION =
  "ARCA rechazó la autenticación aunque la autorización de este contribuyente ya había " +
  "funcionado antes. En ese caso casi siempre significa que el contribuyente no está " +
  "habilitado para facturar: monotributo dado de baja, deuda o inscripción vencida. Hay " +
  "que revisar la situación fiscal en ARCA, porque rehacer el trámite de autorización no " +
  "lo resuelve.";

export function tokenRelationExplanation(onboardingStatus: string): string {
  return hasConfirmedDelegation(onboardingStatus)
    ? BLOCKED_TAXPAYER_EXPLANATION
    : PENDING_DELEGATION_EXPLANATION;
}
