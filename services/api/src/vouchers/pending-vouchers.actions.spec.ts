import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PendingVoucher } from "@prisma/client";
import { DocumentType, PendingVoucherStatus, VoucherConcept, VoucherType } from "@chirola/shared";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { IssuersService } from "../issuers/issuers.service";
import { PrismaService } from "../prisma/prisma.service";
import { ApiClientService } from "../service-auth/api-client.service";
import { PendingVouchersService } from "./pending-vouchers.service";

const OWNER_ID = "user-1";
const ISSUER_ID = "issuer-1";
const API_CLIENT = { id: "client-1", name: "respondi" };

interface StoredRow {
  id: string;
  issuerId: string;
  status: string;
}

interface IdScope {
  id: string;
  issuerId: string;
}

interface FailedScope extends IdScope {
  status: string;
}

function pendingVoucher(id: string, status: string): PendingVoucher {
  return {
    id,
    issuerId: ISSUER_ID,
    idempotencyKey: null,
    payload: {
      issuerId: ISSUER_ID,
      salesPoint: 2,
      voucherType: VoucherType.FACTURA_B,
      concept: VoucherConcept.PRODUCTS,
      recipient: { docType: DocumentType.CONSUMIDOR_FINAL, docNumber: "0" },
      items: [{ description: "Café", quantity: 1, unitPrice: 500, ivaRate: 21 }],
      currency: "PES",
      exchangeRate: 1,
    },
    status,
    retryCount: 1,
    nextRetryAt: new Date("2026-09-22T12:00:00Z"),
    attemptedNumber: null,
    attemptedSalesPoint: null,
    attemptedAt: null,
    lastError: null,
    createdAt: new Date("2026-09-22T10:00:00Z"),
    updatedAt: new Date("2026-09-22T10:00:00Z"),
  };
}

interface Harness {
  service: PendingVouchersService;
  rows: StoredRow[];
  listQueries: unknown[];
  retried: { id: string; data: unknown }[];
}

function matchesFailed(row: StoredRow, where: FailedScope): boolean {
  return row.id === where.id && row.issuerId === where.issuerId && row.status === where.status;
}

async function harness(options: { ownerId?: string; granted?: boolean } = {}): Promise<Harness> {
  const { ownerId = OWNER_ID, granted = true } = options;
  const rows: StoredRow[] = [
    { id: "failed-1", issuerId: ISSUER_ID, status: PendingVoucherStatus.FAILED },
    { id: "queued-1", issuerId: ISSUER_ID, status: PendingVoucherStatus.PENDING },
    { id: "other-issuer", issuerId: "issuer-2", status: PendingVoucherStatus.FAILED },
  ];
  const listQueries: unknown[] = [];
  const retried: Harness["retried"] = [];
  const pendingVoucherTable = {
    findMany: (args: { where: { issuerId: string } }) => {
      listQueries.push(args);
      return Promise.resolve(
        rows
          .filter((row) => row.issuerId === args.where.issuerId)
          .map((row) => pendingVoucher(row.id, row.status)),
      );
    },
    updateMany: ({ where, data }: { where: FailedScope; data: unknown }) => {
      const matched = rows.filter((row) => matchesFailed(row, where));
      matched.forEach((row) => retried.push({ id: row.id, data }));
      return Promise.resolve({ count: matched.length });
    },
    deleteMany: ({ where }: { where: FailedScope }) => {
      const index = rows.findIndex((row) => matchesFailed(row, where));
      if (index < 0) {
        return Promise.resolve({ count: 0 });
      }
      rows.splice(index, 1);
      return Promise.resolve({ count: 1 });
    },
    findFirst: ({ where }: { where: IdScope }) =>
      Promise.resolve(rows.find((row) => row.id === where.id && row.issuerId === where.issuerId) ?? null),
  };
  const getFromUser = (issuerId: string, userId: string): Promise<{ id: string }> =>
    userId === ownerId
      ? Promise.resolve({ id: issuerId })
      : Promise.reject(new ForbiddenException("El emisor no pertenece al usuario."));
  const assertIssuerGranted = (): Promise<void> =>
    granted ? Promise.resolve() : Promise.reject(new ForbiddenException("El emisor no está habilitado."));
  const service = await instantiateWithDoubles(PendingVouchersService, [
    { token: PrismaService, value: { pendingVoucher: pendingVoucherTable } },
    { token: IssuersService, value: { getFromUser } },
    { token: ApiClientService, value: { assertIssuerGranted } },
  ]);
  return { service, rows, listQueries, retried };
}

describe("PendingVouchersService listing", () => {
  it("lists the queue of the issuer, newest first, as summaries", async () => {
    const { service, listQueries } = await harness();

    const summaries = await service.listForUser(OWNER_ID, ISSUER_ID);

    expect(summaries.map((summary) => summary.id)).toEqual(["failed-1", "queued-1"]);
    expect(summaries[0]).toEqual(expect.objectContaining({ totalAmount: 500, currency: "PES" }));
    expect(listQueries).toEqual([{ where: { issuerId: ISSUER_ID }, orderBy: { createdAt: "desc" } }]);
  });

  it("refuses to list the queue of another user's issuer", async () => {
    const { service, listQueries } = await harness({ ownerId: "someone-else" });

    await expect(service.listForUser(OWNER_ID, ISSUER_ID)).rejects.toThrow(ForbiddenException);
    expect(listQueries).toEqual([]);
  });

  it("lists for a granted api client and refuses one without grant", async () => {
    const granted = await harness();
    const denied = await harness({ granted: false });

    await expect(granted.service.listForApiClient(API_CLIENT, ISSUER_ID)).resolves.toHaveLength(2);
    await expect(denied.service.listForApiClient(API_CLIENT, ISSUER_ID)).rejects.toThrow(ForbiddenException);
  });
});

describe("PendingVouchersService retry", () => {
  it("puts a failed voucher back in the queue with a fresh counter", async () => {
    const { service, retried } = await harness();

    await service.retryForUser(OWNER_ID, ISSUER_ID, "failed-1");

    expect(retried.map((entry) => entry.id)).toEqual(["failed-1"]);
    expect(retried[0]?.data).toEqual(
      expect.objectContaining({ status: PendingVoucherStatus.PENDING, retryCount: 0 }),
    );
    expect(retried[0]?.data).toHaveProperty("nextRetryAt");
  });

  it("refuses to retry a voucher that is still queued", async () => {
    const { service } = await harness();

    await expect(service.retryForUser(OWNER_ID, ISSUER_ID, "queued-1")).rejects.toThrow(ConflictException);
  });

  it("does not reach a failed voucher of another issuer", async () => {
    const { service, retried } = await harness();

    await expect(service.retryForApiClient(API_CLIENT, ISSUER_ID, "other-issuer")).rejects.toThrow(
      new NotFoundException("Comprobante en cola inexistente."),
    );
    expect(retried).toEqual([]);
  });

  it("checks the api client grant before retrying", async () => {
    const { service, retried } = await harness({ granted: false });

    await expect(service.retryForApiClient(API_CLIENT, ISSUER_ID, "failed-1")).rejects.toThrow(
      ForbiddenException,
    );
    expect(retried).toEqual([]);
  });
});

describe("PendingVouchersService discard", () => {
  it("deletes a failed voucher of the issuer", async () => {
    const { service, rows } = await harness();

    await service.discardForUser(OWNER_ID, ISSUER_ID, "failed-1");

    expect(rows.map((row) => row.id)).toEqual(["queued-1", "other-issuer"]);
  });

  it("refuses to discard a voucher that is still queued", async () => {
    const { service, rows } = await harness();

    await expect(service.discardForApiClient(API_CLIENT, ISSUER_ID, "queued-1")).rejects.toThrow(
      ConflictException,
    );
    expect(rows).toHaveLength(3);
  });

  it("reports a missing voucher as not found", async () => {
    const { service } = await harness();

    await expect(service.discardForUser(OWNER_ID, ISSUER_ID, "missing")).rejects.toThrow(NotFoundException);
  });
});
