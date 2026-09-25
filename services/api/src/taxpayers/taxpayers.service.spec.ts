import { fakeIssuerAuth } from "../issuer-arca/issuer-arca.fixture";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RecipientIvaCondition, type TaxpayerInfo } from "@chirola/shared";
import { TaxpayersService } from "./taxpayers.service";
import { PrismaService } from "../prisma/prisma.service";
import { PadronService } from "../arca/padron/padron.service";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { MS_PER_DAY } from "../common/time";

const DAYS_PER_YEAR = 365;
const ONE_YEAR_MS = DAYS_PER_YEAR * MS_PER_DAY;

const issuer = {
  id: "issuer-1",
  cuit: "20111111112",
  environment: "homologacion",
  representativeCuit: null,
};

const taxpayer: TaxpayerInfo = {
  cuit: "30707153745",
  legalName: "ACME SA",
  status: "ACTIVO",
  ivaConditionId: RecipientIvaCondition.RESPONSABLE_INSCRIPTO,
  address: null,
};

interface CacheRow {
  cuit: string;
  legalName: string;
  status: string;
  ivaConditionId: number;
  address: unknown;
  fetchedAt: Date;
}

async function build(options: { cached?: CacheRow } = {}) {
  const upserts: CacheRow[] = [];
  const prisma = {
    taxpayerCache: {
      findUnique: () => Promise.resolve(options.cached ?? null),
      upsert: ({ create }: { create: CacheRow }) => {
        upserts.push(create);
        return Promise.resolve(create);
      },
    },
  };

  const lookups: string[] = [];
  const padron = {
    getTaxpayer: (_auth: unknown, cuit: string) => {
      lookups.push(cuit);
      return Promise.resolve(taxpayer);
    },
  };

  const requestedServices: string[] = [];

  const config = {
    get: (_key: string, defaultValue: number) => defaultValue,
  };

  const service = await instantiateWithDoubles(TaxpayersService, [
    { token: PrismaService, value: prisma },
    { token: IssuerAuthService, value: fakeIssuerAuth(requestedServices) },
    { token: PadronService, value: padron },
    { token: ConfigService, value: config },
  ]);
  return { service, lookups, upserts, requestedServices };
}

describe("TaxpayersService", () => {
  it("normaliza el CUIT antes de consultar", async () => {
    const { service, lookups } = await build();

    await service.lookup(issuer, "30-70715374-5");

    expect(lookups).toEqual(["30707153745"]);
  });

  it("rechaza un CUIT que no tenga 11 dígitos", async () => {
    const { service } = await build();

    await expect(service.lookup(issuer, "3070715")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("pide el ticket del servicio de constancia, no el de wsfe", async () => {
    const { service, requestedServices } = await build();

    await service.lookup(issuer, "30707153745");

    expect(requestedServices).toEqual(["ws_sr_constancia_inscripcion"]);
  });

  it("guarda en caché lo que devuelve el padrón", async () => {
    const { service, upserts } = await build();

    await service.lookup(issuer, "30707153745");

    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.legalName).toBe("ACME SA");
  });

  it("usa la caché vigente sin llamar a ARCA", async () => {
    const { service, lookups } = await build({
      cached: {
        cuit: "30707153745",
        legalName: "ACME SA (cacheado)",
        status: "ACTIVO",
        ivaConditionId: RecipientIvaCondition.MONOTRIBUTO,
        address: null,
        fetchedAt: new Date(),
      },
    });

    const result = await service.lookup(issuer, "30707153745");

    expect(lookups).toHaveLength(0);
    expect(result.legalName).toBe("ACME SA (cacheado)");
  });

  it("reconsulta cuando la caché está vencida", async () => {
    const longAgo = new Date(Date.now() - ONE_YEAR_MS);
    const { service, lookups } = await build({
      cached: {
        cuit: "30707153745",
        legalName: "ACME SA (viejo)",
        status: "ACTIVO",
        ivaConditionId: RecipientIvaCondition.MONOTRIBUTO,
        address: null,
        fetchedAt: longAgo,
      },
    });

    const result = await service.lookup(issuer, "30707153745");

    expect(lookups).toEqual(["30707153745"]);
    expect(result.legalName).toBe("ACME SA");
  });

  it("descarta un domicilio cacheado con forma inesperada", async () => {
    const { service } = await build({
      cached: {
        cuit: "30707153745",
        legalName: "ACME SA",
        status: "ACTIVO",
        ivaConditionId: RecipientIvaCondition.RESPONSABLE_INSCRIPTO,
        address: { inesperado: true },
        fetchedAt: new Date(),
      },
    });

    const result = await service.lookup(issuer, "30707153745");

    expect(result.address).toBeNull();
  });
});
