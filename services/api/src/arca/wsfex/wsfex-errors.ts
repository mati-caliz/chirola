import { BadRequestException } from '@nestjs/common';

export class WsfexRejectionError extends BadRequestException {
  constructor(
    readonly codes: string[],
    readonly messages: string[],
  ) {
    super(`ARCA rechazó el comprobante de exportación: ${messages.join(' · ')}`);
  }
}
