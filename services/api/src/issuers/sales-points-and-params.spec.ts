import { ConfigService } from "@nestjs/config";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { PrismaService } from "../prisma/prisma.service";
import { ApiClientService } from "../service-auth/api-client.service";
import { ArcaHealthService } from "./arca-health.service";
import { ArcaParamsService } from "./arca-params.service";
import { IssuersService } from "./issuers.service";
import { SalesPointsService } from "./sales-points.service";
import { V1ParamsController } from "./v1-params.controller";

const USER_ID = "user-1";
const ISSUER_ID = "issuer-1";
const issuer = { id: ISSUER_ID, cuit: "20111111112", environment: "homologacion", representativeCuit: null };
const SALES_POINT = { id: "sp-1", number: 3, description: null };
const REMOTE_NUMBERS = [3, 4];

describe("SalesPointsService", () => {
  async function build() {
    const salesPoint = {
      findMany: jest.fn(() => Promise.resolve([SALES_POINT])),
      upsert: jest.fn(() => Promise.resolve(SALES_POINT)),
      update: jest.fn(({ data }: { data: { description: string | null } }) =>
        Promise.resolve({ ...SALES_POINT, description: data.description }),
      ),
    };
    const getFromUser = jest.fn(() => Promise.resolve(issuer));
    const getSalesPoints = jest.fn(() => Promise.resolve(REMOTE_NUMBERS.map((number) => ({ number }))));
    const service = await instantiateWithDoubles(SalesPointsService, [
      { token: PrismaService, value: { salesPoint } },
      { token: IssuersService, value: { getFromUser } },
      { token: ArcaParamsService, value: { getSalesPoints } },
    ]);
    return { service, salesPoint, getFromUser };
  }

  it("lista sólo los puntos de venta del emisor, después de verificar que es del usuario", async () => {
    const { service, salesPoint, getFromUser } = await build();

    expect(await service.list(USER_ID, ISSUER_ID)).toEqual([SALES_POINT]);
    expect(getFromUser).toHaveBeenCalledWith(ISSUER_ID, USER_ID);
    expect(salesPoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { issuerId: ISSUER_ID } }),
    );
  });

  it("sincroniza con ARCA agregando los que falten sin pisar la descripción", async () => {
    const { service, salesPoint } = await build();

    await service.sync(USER_ID, ISSUER_ID);

    expect(salesPoint.upsert).toHaveBeenCalledTimes(REMOTE_NUMBERS.length);
    expect(salesPoint.upsert).toHaveBeenCalledWith({
      where: { issuerId_number: { issuerId: ISSUER_ID, number: 4 } },
      create: { issuerId: ISSUER_ID, number: 4 },
      update: {},
    });
  });

  it("guarda la descripción y la borra si viene vacía", async () => {
    const { service } = await build();

    expect((await service.updateDescription(USER_ID, ISSUER_ID, 3, "Local")).description).toBe("Local");
    expect((await service.updateDescription(USER_ID, ISSUER_ID, 3, "")).description).toBeNull();
  });
});

describe("V1ParamsController", () => {
  it("resuelve el emisor del cliente de la API y delega cada consulta", async () => {
    const getOwned = jest.fn(() => Promise.resolve(issuer));
    const params = {
      getSalesPoints: jest.fn(() => Promise.resolve([{ number: 1 }])),
      detectFiscalCondition: jest.fn(() => Promise.resolve({ fiscalCondition: null })),
      getCurrencies: jest.fn(() => Promise.resolve([{ id: "DOL" }])),
      getExchangeRate: jest.fn(() => Promise.resolve({ rate: 1000 })),
    };
    const check = jest.fn(() => Promise.resolve({ available: true }));
    const controller = await instantiateWithDoubles(V1ParamsController, [
      { token: IssuersService, value: { getOwned } },
      { token: ArcaParamsService, value: params },
      { token: ArcaHealthService, value: { check } },
      { token: ApiClientService, value: {} },
      { token: ConfigService, value: new ConfigService() },
    ]);
    const apiClient = { id: "cliente-1", name: "respondi" };

    expect(await controller.salesPoints(apiClient, ISSUER_ID)).toEqual([{ number: 1 }]);
    expect(await controller.fiscalCondition(apiClient, ISSUER_ID)).toEqual({ fiscalCondition: null });
    expect(await controller.currencies(apiClient, ISSUER_ID)).toEqual([{ id: "DOL" }]);
    expect(await controller.exchangeRate(apiClient, ISSUER_ID, "DOL")).toEqual({ rate: 1000 });
    expect(await controller.arcaHealthCheck(apiClient, ISSUER_ID)).toEqual({ available: true });
    expect(getOwned).toHaveBeenCalledWith({ apiClientId: "cliente-1" }, ISSUER_ID);
    expect(check).toHaveBeenCalledWith("homologacion");
  });
});
