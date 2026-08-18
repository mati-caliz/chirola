import { HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { VoucherStatus } from '@chirola/shared';

export class VoucherQueuedException extends ServiceUnavailableException {
  constructor(pendingVoucherId: string) {
    super({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'ARCA no disponible. El comprobante quedó encolado para reintento.',
      status: VoucherStatus.PENDING,
      pendingVoucherId,
    });
  }
}
