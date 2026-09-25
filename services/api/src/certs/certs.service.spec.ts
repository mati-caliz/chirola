import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import * as forge from "node-forge";
import type { Certificate, Issuer } from "@prisma/client";
import { CertsService } from "./certs.service";
import { FieldEncryptionService } from "../crypto/field-encryption.service";
import { IssuerOnboardingStatus } from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { MS_PER_DAY } from "../common/time";

type IssuerRow = Partial<Issuer> & { id: string };
type CertificateRow = Partial<Certificate>;

interface SubjectWithFields {
  getField(selector: string | { name: string }): unknown;
}

const DEFAULT_CUIT = "20111111112";
const ENCRYPTION_KEY_BYTES = 32;
const TEST_KEY_BITS = 2048;
const DAYS_PER_YEAR = 365;
const TEST_CERT_VALIDITY_MS = DAYS_PER_YEAR * MS_PER_DAY;
const DEFAULT_ISSUERS: IssuerRow[] = [
  { id: "em1", cuit: DEFAULT_CUIT },
  { id: "otro", cuit: DEFAULT_CUIT },
];

function fakePrisma(issuerRows: IssuerRow[] = []) {
  const store = new Map<string, CertificateRow>();
  const issuers = new Map<string, IssuerRow>(
    (issuerRows.length > 0 ? issuerRows : DEFAULT_ISSUERS).map((row) => [
      row.id,
      {
        representativeCuit: null,
        onboardingStatus: IssuerOnboardingStatus.PENDING_CERTIFICATE,
        ...row,
      },
    ]),
  );
  const findIssuer = ({ where }: { where: { id: string } }) => Promise.resolve(issuers.get(where.id) ?? null);
  return {
    issuer: {
      findUnique: findIssuer,
      findUniqueOrThrow: findIssuer,
      update: ({ where, data }: { where: { id: string }; data: Partial<Issuer> }) => {
        const row = { id: where.id, ...issuers.get(where.id), ...data };
        issuers.set(where.id, row);
        return Promise.resolve(row);
      },
    },
    certificate: {
      upsert: ({
        where,
        create,
        update,
      }: {
        where: { issuerId: string };
        create: CertificateRow;
        update: CertificateRow;
      }) => {
        const previous = store.get(where.issuerId);
        const row = previous === undefined ? { id: "c1", ...create } : { ...previous, ...update };
        store.set(where.issuerId, row);
        return Promise.resolve(row);
      },
      findUnique: ({ where }: { where: { issuerId: string } }) =>
        Promise.resolve(store.get(where.issuerId) ?? null),
      update: ({ where, data }: { where: { issuerId: string }; data: CertificateRow }) => {
        const row = { ...store.get(where.issuerId), ...data };
        store.set(where.issuerId, row);
        return Promise.resolve(row);
      },
    },
  };
}

function encryptionService(): Promise<FieldEncryptionService> {
  const key = randomBytes(ENCRYPTION_KEY_BYTES).toString("base64");
  const config = {
    get: (name: string, defaultValue?: string) => (name === "CERT_ENCRYPTION_KEY" ? key : defaultValue),
  };
  return instantiateWithDoubles(FieldEncryptionService, [{ token: ConfigService, value: config }]);
}

function subjectFieldValue(subject: SubjectWithFields, selector: string | { name: string }): unknown {
  const field = subject.getField(selector);
  if (typeof field !== "object" || field === null || !("value" in field)) return undefined;
  return field.value;
}

function certFromCsr(csrPem: string): string {
  const csr = forge.pki.certificationRequestFromPem(csrPem);
  if (csr.publicKey === null) throw new Error("El CSR no trae clave pública.");
  const certificateAuthorityKeys = forge.pki.rsa.generateKeyPair({ bits: TEST_KEY_BITS });
  const cert = forge.pki.createCertificate();
  cert.publicKey = csr.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + TEST_CERT_VALIDITY_MS);
  cert.setSubject(csr.subject.attributes);
  cert.setIssuer([{ shortName: "CN", value: "AR Test CA" }]);
  cert.sign(certificateAuthorityKeys.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

describe("CertsService — CSR / onboarding", () => {
  const ISSUER = "em1";
  const CUIT = DEFAULT_CUIT;

  async function build(issuerRows: IssuerRow[] = []) {
    const prisma = fakePrisma(issuerRows);
    const service = await instantiateWithDoubles(CertsService, [
      { token: PrismaService, value: prisma },
      { token: FieldEncryptionService, value: await encryptionService() },
    ]);
    return { service, prisma };
  }

  async function createService(issuerRows: IssuerRow[] = []): Promise<CertsService> {
    return (await build(issuerRows)).service;
  }

  it("genera un CSR válido con el subject que exige ARCA", async () => {
    const service = await createService();
    const { csrPem } = await service.generateCsr(
      ISSUER,
      { cuit: CUIT, legalName: "Acme SA" },
      { alias: "chirola-acme" },
    );

    expect(csrPem).toContain("BEGIN CERTIFICATE REQUEST");
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.verify()).toBe(true);
    const commonName = subjectFieldValue(csr.subject, "CN");
    const organization = subjectFieldValue(csr.subject, "O");
    const serialNumber = subjectFieldValue(csr.subject, { name: "serialNumber" });
    expect(commonName).toBe("chirola-acme");
    expect(organization).toBe("Acme SA");
    expect(serialNumber).toBe(`CUIT ${CUIT}`);
  });

  it("usa la razón social como CN cuando no se pasa alias", async () => {
    const { csrPem } = await (
      await createService()
    ).generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(subjectFieldValue(csr.subject, "CN")).toBe("Acme SA");
  });

  it("empareja el .crt cuando corresponde a la clave generada", async () => {
    const service = await createService();
    const { csrPem } = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    const certPem = certFromCsr(csrPem);
    await expect(service.matchCertificate(ISSUER, certPem)).resolves.toBeUndefined();
    const credentials = await service.getCredentials(ISSUER);
    expect(credentials.certPem).toBe(certPem);
    expect(credentials.privateKeyPem).toContain("BEGIN RSA PRIVATE KEY");
  });

  it("rechaza un .crt que no corresponde a la clave generada", async () => {
    const service = await createService();
    await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    const otro = await (await createService()).generateCsr("otro", { cuit: CUIT, legalName: "Otra SA" });
    const certAjeno = certFromCsr(otro.csrPem);
    await expect(service.matchCertificate(ISSUER, certAjeno)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un .crt con PEM inválido", async () => {
    const service = await createService();
    await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    await expect(service.matchCertificate(ISSUER, "no-es-pem")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("devuelve el mismo CSR si se vuelve a pedir, para no invalidar el de ARCA", async () => {
    const service = await createService();
    const primero = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    const segundo = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    expect(segundo.csrPem).toBe(primero.csrPem);

    const cert = certFromCsr(primero.csrPem);
    await expect(service.matchCertificate(ISSUER, cert)).resolves.toBeUndefined();
  });

  it("genera uno nuevo sólo si se lo pide explícitamente", async () => {
    const service = await createService();
    const primero = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    const segundo = await service.generateCsr(
      ISSUER,
      { cuit: CUIT, legalName: "Acme SA" },
      { regenerate: true },
    );
    expect(segundo.csrPem).not.toBe(primero.csrPem);

    const certViejo = certFromCsr(primero.csrPem);
    await expect(service.matchCertificate(ISSUER, certViejo)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("vuelve a generar cuando el emisor ya tiene un certificado emparejado", async () => {
    const service = await createService();
    const primero = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    await service.matchCertificate(ISSUER, certFromCsr(primero.csrPem));
    const renovacion = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    expect(renovacion.csrPem).not.toBe(primero.csrPem);
  });

  it("rechaza un .crt cuyo titular no es el emisor", async () => {
    const service = await createService([{ id: ISSUER, cuit: "27999999993" }]);
    const { csrPem } = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });

    await expect(service.matchCertificate(ISSUER, certFromCsr(csrPem))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("acepta el .crt del representante declarado", async () => {
    const service = await createService([{ id: ISSUER, cuit: "27999999993", representativeCuit: CUIT }]);
    const { csrPem } = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });

    await expect(service.matchCertificate(ISSUER, certFromCsr(csrPem))).resolves.toBeUndefined();
  });

  it("guarda el cuit del titular y deja al emisor esperando la autorización", async () => {
    const service = await createService();
    const { csrPem } = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    await service.matchCertificate(ISSUER, certFromCsr(csrPem));

    const credentials = await service.getCredentials(ISSUER);
    expect(credentials.holderCuit).toBe(CUIT);
  });

  it("deduce el cuit del titular de un certificado guardado sin él", async () => {
    const { service, prisma } = await build();
    const { csrPem } = await service.generateCsr(ISSUER, { cuit: CUIT, legalName: "Acme SA" });
    await service.matchCertificate(ISSUER, certFromCsr(csrPem));
    await prisma.certificate.update({
      where: { issuerId: ISSUER },
      data: { holderCuit: null },
    });

    expect((await service.getCredentials(ISSUER)).holderCuit).toBe(CUIT);
  });

  it("falla al emparejar si no se generó el CSR antes", async () => {
    await expect((await createService()).matchCertificate("sin-csr", "x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
