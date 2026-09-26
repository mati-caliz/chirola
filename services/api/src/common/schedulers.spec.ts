import { Logger } from "@nestjs/common";
import { ArcaCallLogScheduler } from "../arca/arca-call-log.scheduler";
import { ArcaCallLogService } from "../arca/arca-call-log.service";
import { ServiceAuditService } from "../service-auth/service-audit.service";
import { PendingVoucherRetryService } from "../vouchers/pending-voucher-retry.service";
import { VoucherRetryScheduler } from "../vouchers/voucher-retry.scheduler";
import { PrismaService } from "../prisma/prisma.service";
import { instantiateWithDoubles } from "./testing/instantiate-with-doubles";

const PURGED_CALLS = 3;

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
  warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
  errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ArcaCallLogScheduler", () => {
  async function build(purgeExpired: () => Promise<number>): Promise<ArcaCallLogScheduler> {
    return await instantiateWithDoubles(ArcaCallLogScheduler, [
      { token: ArcaCallLogService, value: { purgeExpired } },
    ]);
  }

  it("avisa cuántas llamadas vencidas borró", async () => {
    const scheduler = await build(() => Promise.resolve(PURGED_CALLS));

    await scheduler.purge();

    expect(logSpy).toHaveBeenCalledWith("Se borraron 3 llamadas a ARCA vencidas.");
  });

  it("no dice nada si no había nada que borrar", async () => {
    const scheduler = await build(() => Promise.resolve(0));
    logSpy.mockClear();

    await scheduler.purge();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("un fallo de la base queda como advertencia y no corta el scheduler", async () => {
    const scheduler = await build(() => Promise.reject(new Error("sin conexión")));

    await expect(scheduler.purge()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith("No se pudo purgar el registro de llamadas: sin conexión");
  });
});

describe("VoucherRetryScheduler", () => {
  it("no arranca un ciclo mientras el anterior sigue corriendo", async () => {
    let finish: () => void = () => undefined;
    const retryPendingVouchers = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const scheduler = await instantiateWithDoubles(VoucherRetryScheduler, [
      { token: PendingVoucherRetryService, value: { retryPendingVouchers } },
    ]);

    const first = scheduler.retryPending();
    await scheduler.retryPending();
    finish();
    await first;
    const afterwards = scheduler.retryPending();
    finish();
    await afterwards;

    expect(retryPendingVouchers).toHaveBeenCalledTimes(2);
  });

  it("registra el fallo de un ciclo y deja correr el siguiente", async () => {
    const retryPendingVouchers = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error("ARCA caído"))
      .mockResolvedValueOnce(undefined);
    const scheduler = await instantiateWithDoubles(VoucherRetryScheduler, [
      { token: PendingVoucherRetryService, value: { retryPendingVouchers } },
    ]);

    await scheduler.retryPending();
    await scheduler.retryPending();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ARCA caído"));
    expect(retryPendingVouchers).toHaveBeenCalledTimes(2);
  });
});

describe("ServiceAuditService", () => {
  const entry = {
    apiClientId: "cliente-1",
    method: "POST",
    path: "/api/v1/vouchers",
    outcome: "success" as const,
  };

  it("guarda la entrada de auditoría tal cual", async () => {
    const create = jest.fn(() => Promise.resolve({}));
    const service = await instantiateWithDoubles(ServiceAuditService, [
      { token: PrismaService, value: { serviceAuditLog: { create } } },
    ]);

    await service.record(entry);

    expect(create).toHaveBeenCalledWith({ data: entry });
  });

  it("si la base falla lo registra pero no rompe el pedido auditado", async () => {
    const create = jest.fn(() => Promise.reject(new Error("sin conexión")));
    const service = await instantiateWithDoubles(ServiceAuditService, [
      { token: PrismaService, value: { serviceAuditLog: { create } } },
    ]);

    await expect(service.record(entry)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("No se pudo registrar la auditoría de servicio", expect.any(Error));
  });
});
