import { HttpStatus, ServiceUnavailableException } from '@nestjs/common';

export class VoucherQueuedException extends ServiceUnavailableException {
  constructor(pendingVoucherId: string) {
    super({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'ARCA no disponible. El comprobante quedó encolado para reintento.',
      status: 'PENDIENTE',
      pendingVoucherId,
    });
  }
}
