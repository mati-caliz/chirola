import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as forge from 'node-forge';
import { PrismaService } from '../prisma/prisma.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import type { CredencialesCert } from '../arca/wsaa/wsaa.types';

/**
 * Vault de certificados ARCA. La clave privada se guarda cifrada (AES-256-GCM)
 * y nunca se expone; el `.crt` es público y se guarda en claro.
 */
@Injectable()
export class CertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  /**
   * Guarda (o reemplaza) el material del certificado de un emisor.
   * @param privateKeyPem clave privada en PEM (se cifra at-rest).
   * @param certPem certificado .crt en PEM.
   */
  async guardarCertificado(
    emisorId: string,
    privateKeyPem: string,
    certPem: string,
    alias?: string,
  ): Promise<void> {
    let validoHasta: Date | undefined;
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      validoHasta = cert.validity.notAfter;
    } catch {
      throw new BadRequestException('El certificado (.crt) no es un PEM válido.');
    }

    const privateKeyEnc = this.encryption.encrypt(privateKeyPem);
    await this.prisma.certificado.upsert({
      where: { emisorId },
      create: { emisorId, privateKeyEnc, certPem, alias, validoHasta },
      update: { privateKeyEnc, certPem, alias, validoHasta },
    });
  }

  /**
   * Genera un par de claves RSA + un CSR (PKCS#10) para el emisor y guarda la
   * clave privada cifrada (con `certPem` en null hasta que ARCA devuelva el .crt).
   * Devuelve el CSR en PEM para que el usuario lo suba a "Administración de
   * Certificados Digitales" de ARCA. La clave privada nunca sale del backend.
   *
   * El subject sigue la convención que exige ARCA:
   *   C=AR, O=<razón social>, CN=<alias>, serialNumber=CUIT <cuit>
   */
  async generarCsr(
    emisorId: string,
    cuit: string,
    razonSocial: string,
    alias?: string,
  ): Promise<{ csrPem: string }> {
    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([
      { shortName: 'C', value: 'AR' },
      { shortName: 'O', value: razonSocial },
      { shortName: 'CN', value: alias ?? razonSocial },
      { name: 'serialNumber', value: `CUIT ${cuit}` },
    ]);
    csr.sign(keys.privateKey, forge.md.sha256.create());

    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const csrPem = forge.pki.certificationRequestToPem(csr);

    const privateKeyEnc = this.encryption.encrypt(privateKeyPem);
    // Reemplaza cualquier material previo: al pedir un CSR nuevo, el .crt viejo
    // deja de ser válido para la nueva clave.
    await this.prisma.certificado.upsert({
      where: { emisorId },
      create: { emisorId, privateKeyEnc, certPem: null, alias },
      update: { privateKeyEnc, certPem: null, alias, validoHasta: null },
    });

    return { csrPem };
  }

  /**
   * Empareja el `.crt` descargado de ARCA con la clave privada ya guardada por
   * `generarCsr`. Valida que la clave pública del cert coincida con la del par
   * generado (evita subir un .crt de otro CUIT/clave).
   */
  async emparejarCert(emisorId: string, certPem: string): Promise<void> {
    const existente = await this.prisma.certificado.findUnique({
      where: { emisorId },
    });
    if (!existente) {
      throw new NotFoundException(
        'No hay una clave privada generada para este emisor. Generá primero el CSR.',
      );
    }

    let validoHasta: Date;
    let cert: forge.pki.Certificate;
    try {
      cert = forge.pki.certificateFromPem(certPem);
      validoHasta = cert.validity.notAfter;
    } catch {
      throw new BadRequestException('El certificado (.crt) no es un PEM válido.');
    }

    const privateKeyPem = this.encryption.decrypt(existente.privateKeyEnc);
    if (!this.certMatchesKey(cert, privateKeyPem)) {
      throw new BadRequestException(
        'El certificado no corresponde a la clave privada generada para este emisor.',
      );
    }

    await this.prisma.certificado.update({
      where: { emisorId },
      data: { certPem, validoHasta },
    });
  }

  /** ¿La clave pública del cert coincide con la de la clave privada guardada? */
  private certMatchesKey(
    cert: forge.pki.Certificate,
    privateKeyPem: string,
  ): boolean {
    try {
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const derivedPublicPem = forge.pki.publicKeyToPem(
        forge.pki.setRsaPublicKey(privateKey.n, privateKey.e),
      );
      const certPublicPem = forge.pki.publicKeyToPem(cert.publicKey);
      return derivedPublicPem === certPublicPem;
    } catch {
      return false;
    }
  }

  /** Devuelve las credenciales descifradas para firmar contra ARCA. */
  async getCredenciales(emisorId: string): Promise<CredencialesCert> {
    const cert = await this.prisma.certificado.findUnique({
      where: { emisorId },
    });
    if (!cert || !cert.certPem) {
      throw new NotFoundException(
        'El emisor no tiene un certificado cargado todavía.',
      );
    }
    return {
      certPem: cert.certPem,
      privateKeyPem: this.encryption.decrypt(cert.privateKeyEnc),
    };
  }
}
