import { fakeIssuerAuth } from "../issuer-arca/issuer-arca.fixture";
import { ConfigService } from "@nestjs/config";
import { ArcaParamType, localArcaParams, type ArcaParam } from "@chirola/shared";
import { ArcaParamCacheService } from "./arca-param-cache.service";
import { PrismaService } from "../prisma/prisma.service";
import { WsfeService } from "../arca/wsfe/wsfe.service";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { MS_PER_DAY } from "../common/time";

const issuer = {
  id: "issuer-1",
  cuit: "20111111112",
  environment: "homologacion",
  representativeCuit: null,
};

const fromArca: ArcaParam[] = [
  { id: 1, description: "Impuestos nacionales" },
  { id: 2, description: "Impuestos provinciales" },
];

const DAYS_PER_YEAR = 365;
const ONE_YEAR_MS = DAYS_PER_YEAR * MS_PER_DAY;

interface CacheRow {
  entries: unknown;
  fetchedAt: Date;
}

async function build(options: { cached?: CacheRow; arcaFails?: boolean } = {}) {
  const upserts: unknown[] = [];
  const prisma = {
    arcaParamCache: {
      findUnique: () => Promise.resolve(options.cached ?? null),
      upsert: ({ create }: { create: { entries: unknown } }) => {
        upserts.push(create.entries);
        return Promise.resolve(create);
      },
    },
  };

  let arcaCalls = 0;
  const wsfe = {
    getTributeTypes: () => {
      arcaCalls += 1;
      if (options.arcaFails === true) return Promise.reject(new Error("ARCA caído"));
      return Promise.resolve(fromArca);
    },
  };

  const config = {
    get: (_key: string, defaultValue: number) => defaultValue,
  };

  const service = await instantiateWithDoubles(ArcaParamCacheService, [
    { token: PrismaService, value: prisma },
    { token: IssuerAuthService, value: fakeIssuerAuth() },
    { token: WsfeService, value: wsfe },
    { token: ConfigService, value: config },
  ]);
  return { service, upserts, arcaCalls: () => arcaCalls };
}

describe("ArcaParamCacheService", () => {
  it("consulta ARCA y guarda en caché cuando no hay nada", async () => {
    const { service, upserts } = await build();

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(result).toEqual(fromArca);
    expect(upserts).toEqual([fromArca]);
  });

  it("usa la caché vigente sin llamar a ARCA", async () => {
    const { service, arcaCalls } = await build({
      cached: { entries: fromArca, fetchedAt: new Date() },
    });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(arcaCalls()).toBe(0);
    expect(result).toEqual(fromArca);
  });

  it("refresca cuando la caché venció", async () => {
    const longAgo = new Date(Date.now() - ONE_YEAR_MS);
    const { service, arcaCalls } = await build({
      cached: { entries: [{ id: 9, description: "viejo" }], fetchedAt: longAgo },
    });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(arcaCalls()).toBe(1);
    expect(result).toEqual(fromArca);
  });

  it("cae a la caché vencida si ARCA no responde", async () => {
    const longAgo = new Date(Date.now() - ONE_YEAR_MS);
    const stale = [{ id: 9, description: "viejo pero servible" }];
    const { service } = await build({
      cached: { entries: stale, fetchedAt: longAgo },
      arcaFails: true,
    });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(result).toEqual(stale);
  });

  it("cae a los valores locales si ARCA falla y no hay caché", async () => {
    const { service } = await build({ arcaFails: true });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(result).toEqual(localArcaParams.TRIBUTE_TYPES);
  });

  it("ignora una caché con forma inesperada y consulta ARCA", async () => {
    const { service, arcaCalls } = await build({
      cached: { entries: { roto: true }, fetchedAt: new Date() },
    });

    const result = await service.get(issuer, ArcaParamType.TRIBUTE_TYPES);

    expect(arcaCalls()).toBe(1);
    expect(result).toEqual(fromArca);
  });
});
