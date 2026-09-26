import { Logger } from "@nestjs/common";
import { VencimientoStatus } from "@chirola/shared";
import { WsfeService } from "../arca/wsfe/wsfe.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { MS_PER_DAY } from "../common/time";
import { FiscalAlertsService } from "../fiscal/fiscal-alerts.service";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { ArcaHealthService } from "./arca-health.service";
import { ArcaParamsService } from "./arca-params.service";

const issuer = { id: "issuer-1", cuit: "20111111112", environment: "homologacion", representativeCuit: null };
const AUTH = { token: "t", sign: "s", cuit: issuer.cuit };
const ALL_UP = { appServer: true, dbServer: true, authServer: true };
const NEAR_EXPIRY_DAYS = 10;
const FAR_EXPIRY_DAYS = 200;
const HEALTH_CACHE_TTL_MS = 60_000;
const MONOTRIBUTO_VOUCHER_TYPE = 11;

afterEach(() => {
  jest.restoreAllMocks();
});

describe("FiscalAlertsService", () => {
  async function build(validUntil: Date | null): Promise<FiscalAlertsService> {
    const certificate = { findUnique: () => Promise.resolve(validUntil === null ? null : { validUntil }) };
    return await instantiateWithDoubles(FiscalAlertsService, [
      { token: PrismaService, value: { certificate } },
    ]);
  }

  it("avisa el vencimiento del certificado cuando falta menos de un mes", async () => {
    const service = await build(new Date(Date.now() + NEAR_EXPIRY_DAYS * MS_PER_DAY));

    const alerts = await service.getAlerts(issuer);

    expect(alerts.certificate?.daysToExpiry).toBe(NEAR_EXPIRY_DAYS);
    expect(alerts.vencimientos.every((item) => item.status !== VencimientoStatus.UPCOMING)).toBe(true);
  });

  it("no avisa si el certificado vence lejos o si todavía no hay certificado", async () => {
    const far = await build(new Date(Date.now() + FAR_EXPIRY_DAYS * MS_PER_DAY));
    const missing = await build(null);

    expect((await far.getAlerts(issuer)).certificate).toBeNull();
    expect((await missing.getAlerts(issuer)).certificate).toBeNull();
  });

  it("calcula los vencimientos del período pedido", async () => {
    const service = await build(null);
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-03-31T00:00:00Z");

    const vencimientos = service.getVencimientos(issuer.cuit, from, to);

    expect(vencimientos.length).toBeGreaterThan(0);
    for (const item of vencimientos) {
      expect(new Date(item.dueDate).getTime()).toBeGreaterThanOrEqual(from.getTime() - MS_PER_DAY);
    }
  });
});

describe("ArcaHealthService", () => {
  async function build(checkServers: () => Promise<typeof ALL_UP>): Promise<ArcaHealthService> {
    return await instantiateWithDoubles(ArcaHealthService, [{ token: WsfeService, value: { checkServers } }]);
  }

  it("guarda el resultado un minuto para no pegarle a ARCA en cada pedido", async () => {
    const checkServers = jest.fn(() => Promise.resolve(ALL_UP));
    const service = await build(checkServers);
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);

    const first = await service.check("homologacion");
    const cached = await service.check("homologacion");
    jest.spyOn(Date, "now").mockReturnValue(now + HEALTH_CACHE_TTL_MS + 1);
    await service.check("homologacion");

    expect(first).toMatchObject({ environment: "homologacion", available: true });
    expect(cached).toBe(first);
    expect(checkServers).toHaveBeenCalledTimes(2);
  });

  it("marca todo caído si ARCA no responde", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const service = await build(() => Promise.reject(new Error("timeout")));

    expect(await service.check("produccion")).toMatchObject({
      available: false,
      appServer: false,
      authServer: false,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("timeout"));
  });
});

describe("ArcaParamsService", () => {
  it("autentica al emisor y consulta cada parámetro de ARCA", async () => {
    const wsfe = {
      getSalesPoints: jest.fn(() => Promise.resolve([{ number: 1 }])),
      getCurrencies: jest.fn(() => Promise.resolve([{ id: "DOL" }])),
      getExchangeRate: jest.fn(() => Promise.resolve({ rate: 1000 })),
      getVoucherTypeIds: jest.fn(() => Promise.resolve([MONOTRIBUTO_VOUCHER_TYPE])),
    };
    const buildAuth = jest.fn(() => Promise.resolve(AUTH));
    const service = await instantiateWithDoubles(ArcaParamsService, [
      { token: IssuerAuthService, value: { buildAuth } },
      { token: WsfeService, value: wsfe },
    ]);

    expect(await service.getSalesPoints(issuer)).toEqual([{ number: 1 }]);
    expect(await service.getCurrencies(issuer)).toEqual([{ id: "DOL" }]);
    expect(await service.getExchangeRate(issuer, "DOL")).toEqual({ rate: 1000 });
    expect(await service.detectFiscalCondition(issuer)).toHaveProperty("fiscalCondition");
    expect(buildAuth).toHaveBeenCalledTimes(4);
    expect(wsfe.getExchangeRate).toHaveBeenCalledWith(AUTH, "DOL");
  });
});
