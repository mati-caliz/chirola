import {
  authorizedVoucherStatuses,
  describeVoucherStatus,
  isAuthorizedStatus,
  VoucherStatus,
  voucherStatusName,
} from '@chirola/shared';

describe('estados de comprobante (D.3)', () => {
  it('cuenta el recuperado de ARCA como autorizado', () => {
    expect(isAuthorizedStatus(VoucherStatus.RECOVERED)).toBe(true);
    expect(authorizedVoucherStatuses).toContain(VoucherStatus.RECOVERED);
  });

  it('no cuenta el pendiente ni el rechazado como autorizados', () => {
    expect(isAuthorizedStatus(VoucherStatus.PENDING)).toBe(false);
    expect(isAuthorizedStatus(VoucherStatus.REJECTED)).toBe(false);
  });

  it('traduce cada estado a texto en español para la app', () => {
    for (const status of Object.values(VoucherStatus)) {
      expect(voucherStatusName[status]).toBeTruthy();
      expect(describeVoucherStatus(status)).toBe(voucherStatusName[status]);
    }
  });

  it('devuelve el valor crudo si el estado es desconocido', () => {
    expect(describeVoucherStatus('LO_QUE_SEA')).toBe('LO_QUE_SEA');
  });
});
