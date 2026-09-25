import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { IssuersService } from "./issuers.service";
import { PrismaService } from "../prisma/prisma.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";

const input = {
  cuit: "20111111112",
  legalName: "ACME SRL",
  ivaCondition: "RESPONSABLE_INSCRIPTO" as const,
  environment: "homologacion" as const,
};

function prismaWithTransaction(transactionClient: object): object {
  return {
    $transaction: jest.fn((callback: (client: object) => Promise<unknown>) => callback(transactionClient)),
  };
}

function serviceWith(prisma: object): Promise<IssuersService> {
  return instantiateWithDoubles(IssuersService, [{ token: PrismaService, value: prisma }]);
}

function resolvedWith<Value>(value: Value): jest.Mock<Promise<Value>> {
  return jest.fn(() => Promise.resolve(value));
}

describe("IssuersService.createForApiClient", () => {
  it("crea el emisor con un usuario de servicio y lo habilita para el api client", async () => {
    const userUpsert = resolvedWith({ id: "user-service-1" });
    const issuerCreate = resolvedWith({ id: "issuer-1" });
    const grantCreate = resolvedWith({ id: "grant-1" });
    const service = await serviceWith(
      prismaWithTransaction({
        user: { upsert: userUpsert },
        issuer: { create: issuerCreate },
        apiClientIssuer: { create: grantCreate },
      }),
    );

    const issuer = await service.createForApiClient("client-1", input);

    expect(issuer).toEqual({ id: "issuer-1" });
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "client-1@service.chirola.internal" },
      }),
    );
    expect(issuerCreate).toHaveBeenCalledWith({
      data: { userId: "user-service-1", ...input, commercialAddress: null },
    });
    expect(grantCreate).toHaveBeenCalledWith({
      data: { apiClientId: "client-1", issuerId: "issuer-1" },
    });
  });

  it("traduce el CUIT duplicado a un conflicto", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError("duplicado", {
      code: "P2002",
      clientVersion: "test",
    });
    const service = await serviceWith(
      prismaWithTransaction({
        user: { upsert: resolvedWith({ id: "user-service-1" }) },
        issuer: {
          create: jest.fn(() => {
            throw duplicate;
          }),
        },
        apiClientIssuer: { create: jest.fn() },
      }),
    );

    await expect(service.createForApiClient("client-1", input)).rejects.toThrow(ConflictException);
  });
});

describe("IssuersService.createForApiClient con domicilio comercial", () => {
  it("guarda el domicilio comercial cuando viene en el alta", async () => {
    const issuerCreate = resolvedWith({ id: "issuer-1" });
    const service = await serviceWith(
      prismaWithTransaction({
        user: { upsert: resolvedWith({ id: "user-service-1" }) },
        issuer: { create: issuerCreate },
        apiClientIssuer: { create: jest.fn() },
      }),
    );

    await service.createForApiClient("client-1", {
      ...input,
      commercialAddress: "Av. Corrientes 1234, CABA",
    });

    expect(issuerCreate).toHaveBeenCalledWith({
      data: { userId: "user-service-1", ...input, commercialAddress: "Av. Corrientes 1234, CABA" },
    });
  });
});

describe("IssuersService.updateCommercialAddress", () => {
  it("actualiza sólo el domicilio comercial del emisor", async () => {
    const issuerUpdate = resolvedWith({ id: "issuer-1" });
    const service = await serviceWith({ issuer: { update: issuerUpdate } });

    await service.updateCommercialAddress("issuer-1", { commercialAddress: null });

    expect(issuerUpdate).toHaveBeenCalledWith({
      where: { id: "issuer-1" },
      data: { commercialAddress: null },
    });
  });
});

describe("IssuersService.getWithCertificate", () => {
  const storedIssuer = {
    id: "issuer-1",
    cuit: "20111111112",
    legalName: "ACME SRL",
    commercialAddress: "Av. Corrientes 1234, CABA",
    ivaCondition: "RESPONSABLE_INSCRIPTO",
    environment: "produccion",
    onboardingStatus: "READY",
  };
  const validUntil = new Date("2027-09-24T00:00:00.000Z");

  function serviceReturning(certificate: object | null): Promise<IssuersService> {
    return serviceWith({ issuer: { findUnique: resolvedWith({ ...storedIssuer, certificate }) } });
  }

  it("expone el vencimiento del certificado activo y el domicilio comercial", async () => {
    const service = await serviceReturning({
      alias: "acme",
      validUntil,
      certPem: "PEM",
      holderCuit: "20111111112",
    });
    const issuer = await service.getWithCertificate("issuer-1");

    expect(issuer).toEqual(
      expect.objectContaining({
        id: "issuer-1",
        cuit: "20111111112",
        legalName: "ACME SRL",
        commercialAddress: "Av. Corrientes 1234, CABA",
        ivaCondition: "RESPONSABLE_INSCRIPTO",
        environment: "produccion",
        certificateValidUntil: validUntil,
        certificate: { alias: "acme", validUntil, holderCuit: "20111111112", status: "ready" },
      }),
    );
  });

  it("devuelve el vencimiento en null si el certificado todavía no se cargó", async () => {
    const service = await serviceReturning({
      alias: "acme",
      validUntil: null,
      certPem: null,
      holderCuit: null,
    });
    const issuer = await service.getWithCertificate("issuer-1");

    expect(issuer.certificateValidUntil).toBeNull();
  });

  it("devuelve el vencimiento en null si el emisor no tiene certificado", async () => {
    const issuer = await (await serviceReturning(null)).getWithCertificate("issuer-1");

    expect(issuer.certificateValidUntil).toBeNull();
    expect(issuer.certificate).toBeNull();
  });
});
