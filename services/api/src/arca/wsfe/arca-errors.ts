import { BadRequestException } from '@nestjs/common';

export const ARCA_DUPLICATE_NUMBER_CODE = '10016';

export class ArcaRejectionError extends BadRequestException {
  readonly codes: string[];

  constructor(codes: string[], messages: string[]) {
    super(
      `ARCA rechazó el comprobante: ${
        messages.length ? messages.join(' | ') : 'motivo desconocido'
      }`,
    );
    this.codes = codes;
  }

  hasCode(code: string): boolean {
    return this.codes.includes(code);
  }
}
