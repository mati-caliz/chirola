import { InternalServerErrorException } from '@nestjs/common';
import type { ArcaIssuer } from '../arca/arca-environment';
import {
  assertCertificateBelongsToIssuer,
  expectedCertificateHolderCuit,
} from './issuer-certificate-invariant';

function issuer(overrides: Partial<ArcaIssuer> = {}): ArcaIssuer {
  return {
    id: 'issuer-1',
    cuit: '20435734678',
    environment: 'produccion',
    representativeCuit: null,
    ...overrides,
  };
}

describe('assertCertificateBelongsToIssuer', () => {
  it('acepta el certificado propio del emisor', () => {
    expect(() =>
      assertCertificateBelongsToIssuer(issuer(), '20435734678'),
    ).not.toThrow();
  });

  it('rechaza el certificado de otro contribuyente', () => {
    expect(() =>
      assertCertificateBelongsToIssuer(issuer(), '27111111114'),
    ).toThrow(InternalServerErrorException);
  });

  it('acepta el certificado del representante declarado', () => {
    expect(() =>
      assertCertificateBelongsToIssuer(
        issuer({ representativeCuit: '27111111114' }),
        '27111111114',
      ),
    ).not.toThrow();
  });

  it('rechaza el certificado propio si se declaró un representante', () => {
    expect(() =>
      assertCertificateBelongsToIssuer(
        issuer({ representativeCuit: '27111111114' }),
        '20435734678',
      ),
    ).toThrow(InternalServerErrorException);
  });

  it('ignora los separadores de los dos lados de la comparación', () => {
    expect(() =>
      assertCertificateBelongsToIssuer(
        issuer({ cuit: '20-43573467-8' }),
        '20435734678',
      ),
    ).not.toThrow();
  });

  it('espera el cuit del representante cuando hay uno declarado', () => {
    expect(
      expectedCertificateHolderCuit(issuer({ representativeCuit: '27111111114' })),
    ).toBe('27111111114');
  });
});
