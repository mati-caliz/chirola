import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as forge from 'node-forge';
import { PrismaService } from '../prisma/prisma.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import type { CertificateCredentials } from '../arca/wsaa/wsaa.types';

@Injectable()
export class CertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  async saveCertificate(
    issuerId: string,
    privateKeyPem: string,
    certPem: string,
    alias?: string,
  ): Promise<void> {
    let validUntil: Date | undefined;
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      validUntil = cert.validity.notAfter;
    } catch {
      throw new BadRequestException('El certificado (.crt) no es un PEM válido.');
    }

    const privateKeyEnc = this.encryption.encrypt(privateKeyPem);
    await this.prisma.certificate.upsert({
      where: { issuerId },
      create: { issuerId, privateKeyEnc, certPem, alias, validUntil },
      update: { privateKeyEnc, certPem, alias, validUntil },
    });
  }

  async generateCsr(
    issuerId: string,
    cuit: string,
    legalName: string,
    alias?: string,
  ): Promise<{ csrPem: string }> {
    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([
      { shortName: 'C', value: 'AR' },
      { shortName: 'O', value: legalName },
      { shortName: 'CN', value: alias ?? legalName },
      { name: 'serialNumber', value: `CUIT ${cuit}` },
    ]);
    csr.sign(keys.privateKey, forge.md.sha256.create());

    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const csrPem = forge.pki.certificationRequestToPem(csr);

    const privateKeyEnc = this.encryption.encrypt(privateKeyPem);

    await this.prisma.certificate.upsert({
      where: { issuerId },
      create: { issuerId, privateKeyEnc, certPem: null, alias },
      update: { privateKeyEnc, certPem: null, alias, validUntil: null },
    });

    return { csrPem };
  }

  async matchCertificate(issuerId: string, certPem: string): Promise<void> {
    const existing = await this.prisma.certificate.findUnique({
      where: { issuerId },
    });
    if (!existing) {
      throw new NotFoundException(
        'No hay una clave privada generada para este emisor. Generá primero el CSR.',
      );
    }

    let validUntil: Date;
    let cert: forge.pki.Certificate;
    try {
      cert = forge.pki.certificateFromPem(certPem);
      validUntil = cert.validity.notAfter;
    } catch {
      throw new BadRequestException('El certificado (.crt) no es un PEM válido.');
    }

    const privateKeyPem = this.encryption.decrypt(existing.privateKeyEnc);
    if (!this.certMatchesKey(cert, privateKeyPem)) {
      throw new BadRequestException(
        'El certificado no corresponde a la clave privada generada para este emisor.',
      );
    }

    await this.prisma.certificate.update({
      where: { issuerId },
      data: { certPem, validUntil },
    });
  }

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

  async getCredentials(issuerId: string): Promise<CertificateCredentials> {
    const cert = await this.prisma.certificate.findUnique({
      where: { issuerId },
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
