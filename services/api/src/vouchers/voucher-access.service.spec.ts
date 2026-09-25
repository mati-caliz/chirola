import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { VoucherAccessService } from "./voucher-access.service";
import { buildVoucherDetail } from "./voucher-detail.fixture";
import type { StoredIssuer } from "./voucher-emission.types";
import type { IssuerGrants } from "./voucher-ports";
import type { VoucherAccessTables, VoucherDetail } from "./voucher-tables";

const OWNER_ID = "user-1";
const STRANGER_ID = "user-2";
const API_CLIENT = { id: "client-1", name: "respondi" };

const ISSUER: StoredIssuer = {
  id: "issuer-1",
  userId: OWNER_ID,
  cuit: "20111111112",
  environment: "homologacion",
  representativeCuit: null,
  cbu: null,
  paymentAlias: null,
};

type FindManyArgs = Parameters<VoucherAccessTables["voucher"]["findMany"]>[0];

interface AccessHarness {
  service: VoucherAccessService;
  listQueries: FindManyArgs[];
  grantChecks: { apiClientId: string; issuerId: string }[];
}

function harness(options: { vouchers?: VoucherDetail[]; grantedIssuerIds?: string[] } = {}): AccessHarness {
  const { vouchers = [], grantedIssuerIds = [ISSUER.id] } = options;
  const listQueries: FindManyArgs[] = [];
  const grantChecks: AccessHarness["grantChecks"] = [];
  const tables: VoucherAccessTables = {
    issuer: {
      findUnique: ({ where }) => Promise.resolve(where.id === ISSUER.id ? ISSUER : null),
    },
    voucher: {
      findUnique: ({ where }) => Promise.resolve(vouchers.find((voucher) => voucher.id === where.id) ?? null),
      findMany: (args) => {
        listQueries.push(args);
        return Promise.resolve([]);
      },
    },
  };
  const grants: IssuerGrants = {
    assertIssuerGranted: (apiClientId, issuerId) => {
      grantChecks.push({ apiClientId, issuerId });
      return grantedIssuerIds.includes(issuerId)
        ? Promise.resolve()
        : Promise.reject(new ForbiddenException("El emisor no está habilitado para este cliente."));
    },
  };
  return { service: new VoucherAccessService(tables, grants), listQueries, grantChecks };
}

describe("VoucherAccessService issuer lookups", () => {
  it("returns an existing issuer", async () => {
    await expect(harness().service.findIssuer(ISSUER.id)).resolves.toEqual(ISSUER);
  });

  it("reports a missing issuer as not found", async () => {
    await expect(harness().service.findIssuer("missing")).rejects.toThrow(NotFoundException);
  });

  it("returns the issuer to its owner", async () => {
    await expect(harness().service.findOwnedIssuer(OWNER_ID, ISSUER.id)).resolves.toEqual(ISSUER);
  });

  it("forbids an issuer owned by another user", async () => {
    await expect(harness().service.findOwnedIssuer(STRANGER_ID, ISSUER.id)).rejects.toThrow(
      new ForbiddenException("El emisor no pertenece al usuario."),
    );
  });

  it("checks the grant of the api client for the issuer", async () => {
    const { service, grantChecks } = harness({ grantedIssuerIds: [] });

    await expect(service.assertGranted(API_CLIENT, ISSUER.id)).rejects.toThrow(ForbiddenException);
    expect(grantChecks).toEqual([{ apiClientId: API_CLIENT.id, issuerId: ISSUER.id }]);
  });
});

describe("VoucherAccessService voucher lookups", () => {
  const voucher = buildVoucherDetail();

  it("returns a voucher to the owner of its issuer", async () => {
    await expect(harness({ vouchers: [voucher] }).service.get(OWNER_ID, voucher.id)).resolves.toBe(voucher);
  });

  it("forbids a voucher of an issuer owned by another user", async () => {
    await expect(harness({ vouchers: [voucher] }).service.get(STRANGER_ID, voucher.id)).rejects.toThrow(
      new ForbiddenException("El comprobante no pertenece al usuario."),
    );
  });

  it("reports a missing voucher as not found", async () => {
    await expect(harness().service.get(OWNER_ID, "missing")).rejects.toThrow(
      new NotFoundException("Comprobante inexistente."),
    );
  });

  it("returns a voucher to an api client granted on its issuer", async () => {
    const { service, grantChecks } = harness({ vouchers: [voucher] });

    await expect(service.getForApiClient(API_CLIENT, voucher.id)).resolves.toBe(voucher);
    expect(grantChecks).toEqual([{ apiClientId: API_CLIENT.id, issuerId: voucher.issuerId }]);
  });

  it("hides a voucher from an api client without grant on its issuer", async () => {
    const { service } = harness({ vouchers: [voucher], grantedIssuerIds: [] });

    await expect(service.getForApiClient(API_CLIENT, voucher.id)).rejects.toThrow(ForbiddenException);
  });
});

describe("VoucherAccessService listForIssuer", () => {
  async function takenFor(limit: number | undefined): Promise<number | undefined> {
    const { service, listQueries } = harness();
    await service.listForIssuer(ISSUER.id, limit);
    return listQueries[0]?.take;
  }

  it("scopes the listing to the issuer, newest first", async () => {
    const { service, listQueries } = harness();
    await service.listForIssuer(ISSUER.id);

    expect(listQueries[0]).toEqual(
      expect.objectContaining({
        where: { issuerId: ISSUER.id },
        orderBy: [{ voucherDate: "desc" }, { number: "desc" }],
      }),
    );
  });

  it.each([
    ["no limit", undefined, 20],
    ["a zero limit", 0, 20],
    ["a negative limit", -5, 20],
    ["a non finite limit", Number.NaN, 20],
    ["an infinite limit", Number.POSITIVE_INFINITY, 20],
    ["a fractional limit", 7.9, 7],
    ["a limit within range", 50, 50],
    ["a limit above the maximum", 500, 100],
  ])("takes the right page size for %s", async (_description, limit, expected) => {
    await expect(takenFor(limit)).resolves.toBe(expected);
  });
});
