import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import * as forge from "node-forge";
import { CertsService } from "./certs.service";
import { FieldEncryptionService } from "../crypto/field-encryption.service";
import { IssuerOnboardingStatus } from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";

type Row = Record<string, unknown>;

const DEFAULT_CUIT = "20111111112";

function fakePrisma(issuerRows: Row[] = []): PrismaService {
  const store = new Map<string, Row>();
  const issuers = new Map<string, Row>(
    (issuerRows.length > 0
      ? issuerRows
      : [
          { id: "em1", cuit: DEFAULT_CUIT },
          { id: "otro", cuit: DEFAULT_CUIT },
        ]
    ).map((row) => [
      String(row.id),
      {
        representativeCuit: null,
        onboardingStatus: IssuerOnboardingStatus.PENDING_CERTIFICATE,
        ...row,
      },
    ]),
  );
  const findIssuer = async ({ where }: { where: { id: string } }) => issuers.get(where.id) ?? null;
  return {
    issuer: {
      findUnique: findIssuer,
      findUniqueOrThrow: findIssuer,
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = { ...issuers.get(where.id), ...data };
        issuers.set(where.id, row);
        return row;
      },
    },
    certificate: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { issuerId: string };
        create: Row;
        update: Row;
      }) => {
        const prev = store.get(where.issuerId);
        const row = prev ? { ...prev, ...update } : { id: "c1", ...create };
        store.set(where.issuerId, row);
        return row;
      },
      findUnique: async ({ where }: { where: { issuerId: string } }) => store.get(where.issuerId) ?? null,
      update: async ({ where, data }: { where: { issuerId: string }; data: Row }) => {
        const row = { ...store.get(where.issuerId), ...data };
        store.set(where.issuerId, row);
        return row;
      },
    },
  } as unknown as PrismaService;
}

function encryptionService(): FieldEncryptionService {
  const key = randomBytes(32).toString("base64");
  const config = {
    get: (k: string, def?: string) => (k === "CERT_ENCRYPTION_KEY" ? key : def),
  } as unknown as ConfigService;
  return new FieldEncryptionService(config);
}

function certFromCsr(csrPem: string): string {
  const csr = forge.pki.certificationRequestFromPem(csrPem);
  const ca = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = csr.publicKey!;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 864e5);
  cert.setSubject(csr.subject.attributes);
  cert.setIssuer([{ shortName: "CN", value: "AR Test CA" }]);
  cert.sign(ca.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

describe("CertsService — CSR / onboarding", () => {
  const ISSUER = "em1";
  const CUIT = DEFAULT_CUIT;

  function build(issuerRows: Row[] = []) {
    const prisma = fakePrisma(issuerRows);
    return { service: new CertsService(prisma, encryptionService()), prisma };
  }

  function svc(issuerRows: Row[] = []) {
    return build(issuerRows).service;
  }

  it("genera un CSR válido con el subject que exige ARCA", async () => {
    const service = svc();
    const { csrPem } = await service.generateCsr(ISSUER, CUIT, "Acme SA", "chirola-acme");

    expect(csrPem).toContain("BEGIN CERTIFICATE REQUEST");
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.verify()).toBe(true);
    const cn = csr.subject.getField("CN")?.value;
    const o = csr.subject.getField("O")?.value;
    const serial = csr.subject.getField({ name: "serialNumber" })?.value;
    expect(cn).toBe("chirola-acme");
    expect(o).toBe("Acme SA");
    expect(serial).toBe(`CUIT ${CUIT}`);
  });

  it("usa la razón social como CN cuando no se pasa alias", async () => {
    const { csrPem } = await svc().generateCsr(ISSUER, CUIT, "Acme SA");
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.subject.getField("CN")?.value).toBe("Acme SA");
  });

  it("empareja el .crt cuando corresponde a la clave generada", async () => {
    const service = svc();
    const { csrPem } = await service.generateCsr(ISSUER, CUIT, "Acme SA");
    const certPem = certFromCsr(csrPem);
    await expect(service.matchCertificate(ISSUER, certPem)).resolves.toBeUndefined();
    const creds = await service.getCredentials(ISSUER);
    expect(creds.certPem).toBe(certPem);
    expect(creds.privateKeyPem).toContain("BEGIN RSA PRIVATE KEY");
  });

  it("rechaza un .crt que no corresponde a la clave generada", async () => {
    const service = svc();
    await service.generateCsr(ISSUER, CUIT, "Acme SA");
    const otro = await svc().generateCsr("otro", CUIT, "Otra SA");
    const certAjeno = certFromCsr(otro.csrPem);
    await expect(service.matchCertificate(ISSUER, certAjeno)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un .crt con PEM inválido", async () => {
    const service = svc();
    await service.generateCsr(ISSUER, CUIT, "Acme SA");
    await expect(service.matchCertificate(ISSUER, "no-es-pem")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("devuelve el mismo CSR si se vuelve a pedir, para no invalidar el de ARCA", async () => {
    const service = svc();
    const primero = await service.generateCsr(ISSUER, CUIT, "Acme SA");
    const segundo = await service.generateCsr(ISSUER, CUIT, "Acme SA");
    expect(segundo.csrPem).toBe(primero.csrPem);

    const cert = certFromCsr(primero.csrPem);
    await expect(service.matchCertificate(ISSUER, cert)).resolves.toBeUndefined();
  });

  it("genera uno nuevo sólo si se lo pide explícitamente", async () => {
    const service = svc();
    const primero = await service.generateCsr(ISSUER, CUIT, "Acme SA");
    const segundo = await service.generateCsr(ISSUER, CUIT, "Acme SA", undefined, true);
    expect(segundo.csrPem).not.toBe(primero.csrPem);

    const certViejo = certFromCsr(primero.csrPem);
    await expect(service.matchCertificate(ISSUER, certViejo)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("vuelve a generar cuando el emisor ya tiene un certificado emparejado", async () => {
    const service = svc();
    const primero = await service.generateCsr(ISSUER, CUIT, "Acme SA");
    await service.matchCertificate(ISSUER, certFromCsr(primero.csrPem));
    const renovacion = await service.generateCsr(ISSUER, CUIT, "Acme SA");
    expect(renovacion.csrPem).not.toBe(primero.csrPem);
  });

  it("rechaza un .crt cuyo titular no es el emisor", async () => {
    const service = svc([{ id: ISSUER, cuit: "27999999993" }]);
    const { csrPem } = await service.generateCsr(ISSUER, CUIT, "Acme SA");

    await expect(service.matchCertificate(ISSUER, certFromCsr(csrPem))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("acepta el .crt del representante declarado", async () => {
    const service = svc([{ id: ISSUER, cuit: "27999999993", representativeCuit: CUIT }]);
    const { csrPem } = await service.generateCsr(ISSUER, CUIT, "Acme SA");

    await expect(service.matchCertificate(ISSUER, certFromCsr(csrPem))).resolves.toBeUndefined();
  });

  it("guarda el cuit del titular y deja al emisor esperando la autorización", async () => {
    const service = svc();
    const { csrPem } = await service.generateCsr(ISSUER, CUIT, "Acme SA");
    await service.matchCertificate(ISSUER, certFromCsr(csrPem));

    const credentials = await service.getCredentials(ISSUER);
    expect(credentials.holderCuit).toBe(CUIT);
  });

  it("deduce el cuit del titular de un certificado guardado sin él", async () => {
    const { service, prisma } = build();
    const { csrPem } = await service.generateCsr(ISSUER, CUIT, "Acme SA");
    await service.matchCertificate(ISSUER, certFromCsr(csrPem));
    await prisma.certificate.update({
      where: { issuerId: ISSUER },
      data: { holderCuit: null },
    });

    expect((await service.getCredentials(ISSUER)).holderCuit).toBe(CUIT);
  });

  it("falla al emparejar si no se generó el CSR antes", async () => {
    await expect(svc().matchCertificate("sin-csr", "x")).rejects.toBeInstanceOf(NotFoundException);
  });
});
