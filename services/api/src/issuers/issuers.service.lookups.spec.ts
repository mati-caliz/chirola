import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { PrismaService } from "../prisma/prisma.service";
import { ApiClientService } from "../service-auth/api-client.service";
import { IssuersService, type IssuerOwner } from "./issuers.service";

const OWNER_ID = "user-1";
const ISSUER_CUIT = "20111111112";
const REPRESENTATIVE_CUIT = "27222222223";
const STRANGER_ID = "user-2";
const API_CLIENT_ID = "client-1";
const PAYMENT_CBU = "0000003100010000000001";
const OWNER: IssuerOwner = { userId: OWNER_ID };
const STRANGER: IssuerOwner = { userId: STRANGER_ID };
const API_CLIENT: IssuerOwner = { apiClientId: API_CLIENT_ID };

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

interface IssuerWhere {
  id: string;
  userId?: string;
}

function matches(issuer: StoredIssuer | null, where: IssuerWhere): issuer is StoredIssuer {
  return (
    issuer !== null &&
    issuer.id === where.id &&
    (where.userId === undefined || issuer.userId === where.userId)
  );
}

async function harness(issuer: StoredIssuer | null, grantedIssuerIds: string[] = []): Promise<Harness> {
  const updates: Harness["updates"] = [];
  const creates: unknown[] = [];
  const findManyQueries: unknown[] = [];
  const prisma = {
    issuer: {
      findFirst: ({ where }: { where: IssuerWhere }) =>
        Promise.resolve(matches(issuer, where) ? issuer : null),
      count: ({ where }: { where: { id: string } }) => Promise.resolve(matches(issuer, where) ? 1 : 0),
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
  const grants = {
    assertIssuerGranted: (_apiClientId: string, issuerId: string) =>
      grantedIssuerIds.includes(issuerId)
        ? Promise.resolve()
        : Promise.reject(new ForbiddenException("El emisor no está habilitado para este cliente.")),
  };
  const service = await instantiateWithDoubles(IssuersService, [
    { token: PrismaService, value: prisma },
    { token: ApiClientService, value: grants },
  ]);
  return { service, updates, creates, findManyQueries };
}

describe("IssuersService ownership lookups", () => {
  it("returns the issuer to its owner", async () => {
    const { service } = await harness(storedIssuer());

    await expect(service.getFromUser("issuer-1", OWNER_ID)).resolves.toEqual(storedIssuer());
  });

  it("forbids the issuer to another user", async () => {
    const { service } = await harness(storedIssuer());

    await expect(service.getFromUser("issuer-1", STRANGER_ID)).rejects.toThrow(
      new ForbiddenException("El emisor no pertenece al usuario."),
    );
  });

  it.each([
    ["getFromUser", (service: IssuersService) => service.getFromUser("missing", OWNER_ID)],
    ["getOwned", (service: IssuersService) => service.getOwned(OWNER, "missing")],
    ["getWithCertificate", (service: IssuersService) => service.getWithCertificate(OWNER, "missing")],
    [
      "updateRepresentative",
      (service: IssuersService) =>
        service.updateRepresentative(OWNER, "missing", { representativeCuit: null }),
    ],
    [
      "updatePaymentAccount",
      (service: IssuersService) => service.updatePaymentAccount(OWNER, "missing", { cbu: PAYMENT_CBU }),
    ],
    [
      "updateCommercialAddress",
      (service: IssuersService) =>
        service.updateCommercialAddress(OWNER, "missing", { commercialAddress: null }),
    ],
  ])("reports a missing issuer as not found in %s", async (_method, call) => {
    const { service, updates } = await harness(storedIssuer());

    await expect(call(service)).rejects.toThrow(new NotFoundException("Emisor inexistente."));
    expect(updates).toEqual([]);
  });

  it("returns an issuer to a granted api client", async () => {
    const { service } = await harness(storedIssuer(), ["issuer-1"]);

    await expect(service.getOwned(API_CLIENT, "issuer-1")).resolves.toEqual(storedIssuer());
  });

  it("reports a granted but missing issuer as not found to the api client", async () => {
    const { service } = await harness(null, ["issuer-1"]);

    await expect(service.getOwned(API_CLIENT, "issuer-1")).rejects.toThrow(
      new NotFoundException("Emisor inexistente."),
    );
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

    await service.updatePaymentAccount(OWNER, "issuer-1", { cbu: PAYMENT_CBU });

    expect(updates).toEqual([
      { where: { id: "issuer-1", userId: OWNER_ID }, data: { cbu: PAYMENT_CBU, paymentAlias: null } },
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

    await service.updateRepresentative(OWNER, "issuer-1", { representativeCuit: REPRESENTATIVE_CUIT });

    expect(updates).toEqual([
      { where: { id: "issuer-1", userId: OWNER_ID }, data: { representativeCuit: REPRESENTATIVE_CUIT } },
    ]);
  });

  it("ignores a certificate request that has no certificate yet", async () => {
    const { service, updates } = await harness(storedIssuer({ certPem: null, holderCuit: ISSUER_CUIT }));

    await service.updateRepresentative(OWNER, "issuer-1", { representativeCuit: REPRESENTATIVE_CUIT });

    expect(updates).toHaveLength(1);
  });

  it("accepts a representative matching the loaded certificate holder", async () => {
    const { service, updates } = await harness(
      storedIssuer({ certPem: "-----BEGIN CERTIFICATE-----", holderCuit: REPRESENTATIVE_CUIT }),
    );

    await service.updateRepresentative(OWNER, "issuer-1", { representativeCuit: REPRESENTATIVE_CUIT });

    expect(updates).toHaveLength(1);
  });

  it("accepts clearing the representative when the certificate belongs to the issuer itself", async () => {
    const { service, updates } = await harness(
      storedIssuer({ certPem: "-----BEGIN CERTIFICATE-----", holderCuit: ISSUER_CUIT }),
    );

    await service.updateRepresentative(OWNER, "issuer-1", { representativeCuit: null });

    expect(updates).toEqual([
      { where: { id: "issuer-1", userId: OWNER_ID }, data: { representativeCuit: null } },
    ]);
  });

  it("refuses a representative that would not match the loaded certificate holder", async () => {
    const { service, updates } = await harness(
      storedIssuer({ certPem: "-----BEGIN CERTIFICATE-----", holderCuit: ISSUER_CUIT }),
    );

    await expect(
      service.updateRepresentative(OWNER, "issuer-1", { representativeCuit: REPRESENTATIVE_CUIT }),
    ).rejects.toThrow(ConflictException);
    expect(updates).toEqual([]);
  });

  it("does not block when the loaded certificate has no known holder", async () => {
    const { service, updates } = await harness(
      storedIssuer({ certPem: "-----BEGIN CERTIFICATE-----", holderCuit: null }),
    );

    await service.updateRepresentative(OWNER, "issuer-1", { representativeCuit: REPRESENTATIVE_CUIT });

    expect(updates).toHaveLength(1);
  });
});

type IssuerCall = (service: IssuersService, owner: IssuerOwner) => Promise<unknown>;

const OWNERSHIP_CHECKED_CALLS: [string, IssuerCall][] = [
  ["getOwned", (service, owner) => service.getOwned(owner, "issuer-1")],
  ["getWithCertificate", (service, owner) => service.getWithCertificate(owner, "issuer-1")],
  [
    "updateRepresentative",
    (service, owner) => service.updateRepresentative(owner, "issuer-1", { representativeCuit: null }),
  ],
  [
    "updatePaymentAccount",
    (service, owner) => service.updatePaymentAccount(owner, "issuer-1", { cbu: PAYMENT_CBU }),
  ],
  [
    "updateCommercialAddress",
    (service, owner) => service.updateCommercialAddress(owner, "issuer-1", { commercialAddress: null }),
  ],
];

describe("IssuersService isolation between owners", () => {
  it.each(OWNERSHIP_CHECKED_CALLS)(
    "forbids %s on an issuer of another user without writing",
    async (_method, call) => {
      const { service, updates } = await harness(storedIssuer());

      await expect(call(service, STRANGER)).rejects.toThrow(
        new ForbiddenException("El emisor no pertenece al usuario."),
      );
      expect(updates).toEqual([]);
    },
  );

  it.each(OWNERSHIP_CHECKED_CALLS)(
    "forbids %s to an api client without grant without writing",
    async (_method, call) => {
      const { service, updates } = await harness(storedIssuer());

      await expect(call(service, API_CLIENT)).rejects.toThrow(
        new ForbiddenException("El emisor no está habilitado para este cliente."),
      );
      expect(updates).toEqual([]);
    },
  );

  it("writes a granted api client update scoped to the issuer", async () => {
    const { service, updates } = await harness(storedIssuer(), ["issuer-1"]);

    await service.updateCommercialAddress(API_CLIENT, "issuer-1", { commercialAddress: null });

    expect(updates).toEqual([{ where: { id: "issuer-1" }, data: { commercialAddress: null } }]);
  });
});
