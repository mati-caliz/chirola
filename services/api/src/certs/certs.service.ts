import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import * as forge from "node-forge";
import { IssuerOnboardingStatus, hasConfirmedDelegation, normalizeCuit } from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import { FieldEncryptionService } from "../crypto/field-encryption.service";
import type { CertificateCredentials } from "../arca/wsaa/wsaa.types";
import { certificateHolderCuit } from "./certificate-subject";

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
    const cert = this.parseCertificate(certPem);
    const validUntil = cert.validity.notAfter;
    const holderCuit = await this.assertCertificateHolder(issuerId, cert);

    const privateKeyEnc = this.encryption.encrypt(privateKeyPem);
    await this.prisma.certificate.upsert({
      where: { issuerId },
      create: { issuerId, privateKeyEnc, certPem, holderCuit, alias, validUntil },
      update: { privateKeyEnc, certPem, holderCuit, alias, validUntil },
    });
    await this.markCertificateLoaded(issuerId);
  }

  async generateCsr(
    issuerId: string,
    cuit: string,
    legalName: string,
    alias?: string,
    regenerate = false,
  ): Promise<{ csrPem: string }> {
    if (!regenerate) {
      const pending = await this.prisma.certificate.findUnique({
        where: { issuerId },
      });
      if (pending?.csrPem && !pending.certPem) {
        return { csrPem: pending.csrPem };
      }
    }

    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([
      { shortName: "C", value: "AR" },
      { shortName: "O", value: legalName },
      { shortName: "CN", value: alias ?? legalName },
      { name: "serialNumber", value: `CUIT ${cuit}` },
    ]);
    csr.sign(keys.privateKey, forge.md.sha256.create());

    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const csrPem = forge.pki.certificationRequestToPem(csr);

    const privateKeyEnc = this.encryption.encrypt(privateKeyPem);

    await this.prisma.certificate.upsert({
      where: { issuerId },
      create: { issuerId, privateKeyEnc, csrPem, certPem: null, alias },
      update: { privateKeyEnc, csrPem, certPem: null, alias, validUntil: null },
    });

    return { csrPem };
  }

  async matchCertificate(issuerId: string, certPem: string): Promise<void> {
    const existing = await this.prisma.certificate.findUnique({
      where: { issuerId },
    });
    if (!existing) {
      throw new NotFoundException(
        "No hay una clave privada generada para este emisor. Generá primero el CSR.",
      );
    }

    const cert = this.parseCertificate(certPem);
    const validUntil = cert.validity.notAfter;

    const privateKeyPem = this.encryption.decrypt(existing.privateKeyEnc);
    if (!this.certMatchesKey(cert, privateKeyPem)) {
      throw new BadRequestException(
        "El certificado no corresponde a la clave privada generada para este emisor.",
      );
    }
    const holderCuit = await this.assertCertificateHolder(issuerId, cert);

    await this.prisma.certificate.update({
      where: { issuerId },
      data: { certPem, holderCuit, validUntil },
    });
    await this.markCertificateLoaded(issuerId);
  }

  private parseCertificate(certPem: string): forge.pki.Certificate {
    try {
      return forge.pki.certificateFromPem(certPem);
    } catch {
      throw new BadRequestException("El certificado (.crt) no es un PEM válido.");
    }
  }

  private async assertCertificateHolder(issuerId: string, cert: forge.pki.Certificate): Promise<string> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: issuerId },
      select: { cuit: true, representativeCuit: true },
    });
    if (!issuer) throw new NotFoundException("Emisor inexistente.");

    const holderCuit = certificateHolderCuit(cert);
    if (!holderCuit) {
      throw new BadRequestException(
        "El certificado no declara el CUIT de su titular. " + "No parece un certificado emitido por ARCA.",
      );
    }

    const expectedHolderCuit = normalizeCuit(issuer.representativeCuit ?? issuer.cuit);
    if (holderCuit !== expectedHolderCuit) {
      throw new BadRequestException(
        issuer.representativeCuit
          ? `El certificado pertenece al CUIT ${holderCuit}, pero el emisor declara ` +
              `como representante al CUIT ${issuer.representativeCuit}.`
          : `El certificado pertenece al CUIT ${holderCuit} y el emisor es el CUIT ` +
              `${issuer.cuit}. Si es un representante que factura en nombre de este ` +
              "contribuyente, hay que declararlo en el emisor antes de cargar el certificado.",
      );
    }
    return holderCuit;
  }

  private async markCertificateLoaded(issuerId: string): Promise<void> {
    const issuer = await this.prisma.issuer.findUniqueOrThrow({
      where: { id: issuerId },
      select: { onboardingStatus: true },
    });
    if (hasConfirmedDelegation(issuer.onboardingStatus)) return;
    await this.prisma.issuer.update({
      where: { id: issuerId },
      data: { onboardingStatus: IssuerOnboardingStatus.PENDING_DELEGATION },
    });
  }

  private certMatchesKey(cert: forge.pki.Certificate, privateKeyPem: string): boolean {
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
      throw new NotFoundException("El emisor no tiene un certificado cargado todavía.");
    }
    return {
      certPem: cert.certPem,
      privateKeyPem: this.encryption.decrypt(cert.privateKeyEnc),
      holderCuit: cert.holderCuit ?? (await this.backfillHolderCuit(issuerId, cert.certPem)),
    };
  }

  private async backfillHolderCuit(issuerId: string, certPem: string): Promise<string | null> {
    const holderCuit = certificateHolderCuit(this.parseCertificate(certPem));
    if (!holderCuit) return null;
    await this.prisma.certificate.update({
      where: { issuerId },
      data: { holderCuit },
    });
    return holderCuit;
  }
}
