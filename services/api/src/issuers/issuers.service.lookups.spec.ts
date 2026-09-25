import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { PrismaService } from "../prisma/prisma.service";
import { IssuersService } from "./issuers.service";

const OWNER_ID = "user-1";
const ISSUER_CUIT = "20111111112";
const REPRESENTATIVE_CUIT = "27222222223";

interface StoredCertificate {
  certPem: string | null;
  holderCuit: string | null;
}

interface StoredIssuer {
  id: string;
  userId: string;
  cuit: string;
  certificate: StoredCertificate | null;
}

interface Harness {
  service: IssuersService;
  updates: { where: unknown; data: unknown }[];
  creates: unknown[];
  findManyQueries: unknown[];
}

function storedIssuer(certificate: StoredCertificate | null = null): StoredIssuer {
  return { id: "issuer-1", userId: OWNER_ID, cuit: ISSUER_CUIT, certificate };
}

async function harness(issuer: StoredIssuer | null, grantedIssuerIds: string[] = []): Promise<Harness> {
  const updates: Harness["updates"] = [];
  const creates: unknown[] = [];
  const findManyQueries: unknown[] = [];
  const prisma = {
    issuer: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(issuer !== null && where.id === issuer.id ? issuer : null),
      findMany: (args: unknown) => {
        findManyQueries.push(args);
        return Promise.resolve([]);
      },
      update: (args: { where: unknown; data: unknown }) => {
        updates.push(args);
        return Promise.resolve(issuer);
      },
      create: (args: unknown) => {
        creates.push(args);
        return Promise.resolve(issuer);
      },
    },
    apiClientIssuer: {
      findMany: () => Promise.resolve(grantedIssuerIds.map((issuerId) => ({ issuerId }))),
    },
    $transaction: () => Promise.reject(new Error("conexión perdida")),
  };
  const service = await instantiateWithDoubles(IssuersService, [{ token: PrismaService, value: prisma }]);
  return { service, updates, creates, findManyQueries };
}

describe("IssuersService ownership lookups", () => {
  it("returns the issuer to its owner", async () => {
    const { service } = await harness(storedIssuer());

    await expect(service.getFromUser("issuer-1", OWNER_ID)).resolves.toEqual(storedIssuer());
  });

  it("forbids the issuer to another user", async () => {
    const { service } = await harness(storedIssuer());

    await expect(service.getFromUser("issuer-1", "user-2")).rejects.toThrow(
      new ForbiddenException("El emisor no pertenece al usuario."),
    );
  });

  it.each([
    ["getFromUser", (service: IssuersService) => service.getFromUser("missing", OWNER_ID)],
    ["getById", (service: IssuersService) => service.getById("missing")],
    ["getWithCertificate", (service: IssuersService) => service.getWithCertificate("missing")],
    [
      "updateRepresentative",
      (service: IssuersService) => service.updateRepresentative("missing", { representativeCuit: null }),
    ],
  ])("reports a missing issuer as not found in %s", async (_method, call) => {
    const { service } = await harness(storedIssuer());

    await expect(call(service)).rejects.toThrow(new NotFoundException("Emisor inexistente."));
  });

  it("returns an issuer by id", async () => {
    const { service } = await harness(storedIssuer());

    await expect(service.getById("issuer-1")).resolves.toEqual(storedIssuer());
  });

  it("lists only the issuers of the user", async () => {
    const { service, findManyQueries } = await harness(storedIssuer());

    await service.list(OWNER_ID);

    expect(findManyQueries).toEqual([expect.objectContaining({ where: { userId: OWNER_ID } })]);
  });

  it("lists only the issuers granted to the api client", async () => {
    const { service, findManyQueries } = await harness(storedIssuer(), ["issuer-1", "issuer-3"]);

    await service.listForApiClient("client-1");

    expect(findManyQueries).toEqual([
      expect.objectContaining({ where: { id: { in: ["issuer-1", "issuer-3"] } } }),
    ]);
  });
});

describe("IssuersService writes", () => {
  it("creates an issuer for the user without commercial address", async () => {
    const { service, creates } = await harness(storedIssuer());

    await service.create(OWNER_ID, {
      cuit: ISSUER_CUIT,
      legalName: "ACME SRL",
      ivaCondition: "RESPONSABLE_INSCRIPTO",
      environment: "homologacion",
    });

    expect(creates).toEqual([
      {
        data: {
          userId: OWNER_ID,
          cuit: ISSUER_CUIT,
          legalName: "ACME SRL",
          commercialAddress: null,
          ivaCondition: "RESPONSABLE_INSCRIPTO",
          environment: "homologacion",
        },
      },
    ]);
  });

  it("stores the payment account, clearing a missing alias", async () => {
    const { service, updates } = await harness(storedIssuer());

    await service.updatePaymentAccount("issuer-1", { cbu: "0000003100010000000001" });

    expect(updates).toEqual([
      { where: { id: "issuer-1" }, data: { cbu: "0000003100010000000001", paymentAlias: null } },
    ]);
  });

  it("propagates unexpected errors when creating for an api client", async () => {
    const { service } = await harness(storedIssuer());

    await expect(
      service.createForApiClient("client-1", {
        cuit: ISSUER_CUIT,
        legalName: "ACME SRL",
        ivaCondition: "RESPONSABLE_INSCRIPTO",
        environment: "homologacion",
      }),
    ).rejects.toThrow("conexión perdida");
  });
});

describe("IssuersService.updateRepresentative", () => {
  it("sets a representative when no certificate is loaded yet", async () => {
    const { service, updates } = await harness(storedIssuer());

    await service.updateRepresentative("issuer-1", { representativeCuit: REPRESENTATIVE_CUIT });

    expect(updates).toEqual([
      { where: { id: "issuer-1" }, data: { representativeCuit: REPRESENTATIVE_CUIT } },
    ]);
  });

  it("ignores a certificate request that has no certificate yet", async () => {
    const { service, updates } = await harness(storedIssuer({ certPem: null, holderCuit: ISSUER_CUIT }));

    await service.updateRepresentative("issuer-1", { representativeCuit: REPRESENTATIVE_CUIT });

    expect(updates).toHaveLength(1);
  });

  it("accepts a representative matching the loaded certificate holder", async () => {
    const { service, updates } = await harness(
      storedIssuer({ certPem: "-----BEGIN CERTIFICATE-----", holderCuit: REPRESENTATIVE_CUIT }),
    );

    await service.updateRepresentative("issuer-1", { representativeCuit: REPRESENTATIVE_CUIT });

    expect(updates).toHaveLength(1);
  });

  it("accepts clearing the representative when the certificate belongs to the issuer itself", async () => {
    const { service, updates } = await harness(
      storedIssuer({ certPem: "-----BEGIN CERTIFICATE-----", holderCuit: ISSUER_CUIT }),
    );

    await service.updateRepresentative("issuer-1", { representativeCuit: null });

    expect(updates).toEqual([{ where: { id: "issuer-1" }, data: { representativeCuit: null } }]);
  });

  it("refuses a representative that would not match the loaded certificate holder", async () => {
    const { service, updates } = await harness(
      storedIssuer({ certPem: "-----BEGIN CERTIFICATE-----", holderCuit: ISSUER_CUIT }),
    );

    await expect(
      service.updateRepresentative("issuer-1", { representativeCuit: REPRESENTATIVE_CUIT }),
    ).rejects.toThrow(ConflictException);
    expect(updates).toEqual([]);
  });

  it("does not block when the loaded certificate has no known holder", async () => {
    const { service, updates } = await harness(
      storedIssuer({ certPem: "-----BEGIN CERTIFICATE-----", holderCuit: null }),
    );

    await service.updateRepresentative("issuer-1", { representativeCuit: REPRESENTATIVE_CUIT });

    expect(updates).toHaveLength(1);
  });
});
