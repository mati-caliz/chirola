import { InternalServerErrorException } from '@nestjs/common';
import { normalizeCuit } from '@chirola/shared';
import type { ArcaIssuer } from '../arca/arca-environment';

export function expectedCertificateHolderCuit(issuer: ArcaIssuer): string {
  return normalizeCuit(issuer.representativeCuit ?? issuer.cuit);
}

export function assertCertificateBelongsToIssuer(
  issuer: ArcaIssuer,
  holderCuit: string,
): void {
  if (normalizeCuit(holderCuit) === expectedCertificateHolderCuit(issuer)) {
    return;
  }
  throw new InternalServerErrorException(
    `El certificado guardado pertenece al CUIT ${holderCuit} y el emisor factura como ` +
      `CUIT ${issuer.cuit}. Se cortó la operación para no emitir comprobantes a nombre ` +
      'de otro contribuyente. Hay que volver a cargar el certificado que corresponde.',
  );
}
