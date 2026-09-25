import { BadRequestException } from "@nestjs/common";

export const ARCA_DUPLICATE_NUMBER_CODE = "10016";

export const ARCA_TOKEN_RELATION_CODE = "600";

const DEFAULT_REJECTION_SUMMARY = "ARCA rechazó el comprobante";

export class ArcaRejectionError extends BadRequestException {
  readonly codes: string[];

  constructor(codes: string[], messages: string[], summary: string = DEFAULT_REJECTION_SUMMARY) {
    super(`${summary}: ${messages.length > 0 ? messages.join(" | ") : "motivo desconocido"}`);
    this.codes = codes;
  }

  hasCode(code: string): boolean {
    return this.codes.includes(code);
  }
}

export class ArcaDelegationError extends ArcaRejectionError {
  constructor(codes: string[], explanation: string) {
    super(codes, [explanation], "ARCA rechazó la autenticación");
  }
}

export function assertNoArcaErrors(xml: { errors(): string[]; errorCodes(): string[] }): void {
  const errors = xml.errors();
  if (errors.length > 0) {
    throw new ArcaRejectionError(xml.errorCodes(), errors);
  }
}
