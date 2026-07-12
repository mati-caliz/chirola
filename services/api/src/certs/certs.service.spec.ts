import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import * as forge from 'node-forge';
import { CertsService } from './certs.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { PrismaService } from '../prisma/prisma.service';

function fakePrisma(): PrismaService {
  const store = new Map<string, any>();
  return {
    certificate: {
      upsert: async ({ where, create, update }: any) => {
        const prev = store.get(where.issuerId);
        const row = prev
          ? { ...prev, ...update }
          : { id: 'c1', ...create };
        store.set(where.issuerId, row);
        return row;
      },
      findUnique: async ({ where }: any) => store.get(where.issuerId) ?? null,
      update: async ({ where, data }: any) => {
        const row = { ...store.get(where.issuerId), ...data };
        store.set(where.issuerId, row);
        return row;
      },
    },
  } as unknown as PrismaService;
}

function encryptionService(): FieldEncryptionService {
  const key = randomBytes(32).toString('base64');
  const config = {
    get: (k: string, def?: string) =>
      k === 'CERT_ENCRYPTION_KEY' ? key : def,
  } as unknown as ConfigService;
  return new FieldEncryptionService(config);
}

function certFromCsr(csrPem: string): string {
  const csr = forge.pki.certificationRequestFromPem(csrPem);
  const ca = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = csr.publicKey!;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 864e5);
  cert.setSubject(csr.subject.attributes);
  cert.setIssuer([{ shortName: 'CN', value: 'AR Test CA' }]);
  cert.sign(ca.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

describe('CertsService — CSR / onboarding', () => {
  const ISSUER = 'em1';
  const CUIT = '20111111112';

  function svc() {
    return new CertsService(fakePrisma(), encryptionService());
  }

  it('genera un CSR válido con el subject que exige ARCA', async () => {
    const service = svc();
    const { csrPem } = await service.generateCsr(
      ISSUER,
      CUIT,
      'Acme SA',
      'chirola-acme',
    );

    expect(csrPem).toContain('BEGIN CERTIFICATE REQUEST');
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.verify()).toBe(true);
    const cn = csr.subject.getField('CN')?.value;
    const o = csr.subject.getField('O')?.value;
    const serial = csr.subject.getField({ name: 'serialNumber' })?.value;
    expect(cn).toBe('chirola-acme');
    expect(o).toBe('Acme SA');
    expect(serial).toBe(`CUIT ${CUIT}`);
  });

  it('usa la razón social como CN cuando no se pasa alias', async () => {
    const { csrPem } = await svc().generateCsr(ISSUER, CUIT, 'Acme SA');
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.subject.getField('CN')?.value).toBe('Acme SA');
  });

  it('empareja el .crt cuando corresponde a la clave generada', async () => {
    const service = svc();
    const { csrPem } = await service.generateCsr(ISSUER, CUIT, 'Acme SA');
    const certPem = certFromCsr(csrPem);
    await expect(service.matchCertificate(ISSUER, certPem)).resolves.toBeUndefined();
    const creds = await service.getCredentials(ISSUER);
    expect(creds.certPem).toBe(certPem);
    expect(creds.privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
  });

  it('rechaza un .crt que no corresponde a la clave generada', async () => {
    const service = svc();
    await service.generateCsr(ISSUER, CUIT, 'Acme SA');
    const otro = await svc().generateCsr('otro', CUIT, 'Otra SA');
    const certAjeno = certFromCsr(otro.csrPem);
    await expect(service.matchCertificate(ISSUER, certAjeno)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza un .crt con PEM inválido', async () => {
    const service = svc();
    await service.generateCsr(ISSUER, CUIT, 'Acme SA');
    await expect(service.matchCertificate(ISSUER, 'no-es-pem')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('falla al emparejar si no se generó el CSR antes', async () => {
    await expect(svc().matchCertificate('sin-csr', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
