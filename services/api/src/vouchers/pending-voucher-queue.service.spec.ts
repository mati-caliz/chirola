import { Prisma } from "@prisma/client";
import { PendingVoucherStatus } from "@chirola/shared";
import type { PushMessage } from "../notifications/push-notification.service";
import { queuedVoucherAuthorizedMessage, queuedVoucherFailedMessage } from "../notifications/push-messages";
import { WebhookEvent } from "../webhooks/webhook-events";
import { PendingVoucherQueue } from "./pending-voucher-queue.service";
import { buildInput } from "./voucher-emission.fixture";
import type { IssuedVoucher, StoredIssuer } from "./voucher-emission.types";
import type { IssuerOwnerNotifier, VoucherRetryPolicy, WebhookDispatcher } from "./voucher-ports";
import type {
  PendingVoucherData,
  PendingVoucherRow,
  PendingVoucherTables,
  PendingVoucherUpdate,
} from "./voucher-tables";

const RETRY_BASE_MS = 1_000;
const MAX_RETRIES = 3;
const NOW = new Date("2026-09-24T12:00:00Z").getTime();
const POLICY: VoucherRetryPolicy = { maxRetries: MAX_RETRIES, retryBaseMs: RETRY_BASE_MS };

const ISSUER: StoredIssuer = {
  id: "issuer-1",
  userId: "user-1",
  cuit: "20111111112",
  environment: "homologacion",
  representativeCuit: null,
  cbu: null,
  paymentAlias: null,
};

const EXISTING_ROW: PendingVoucherRow = {
  id: "pending-existing",
  issuerId: ISSUER.id,
  idempotencyKey: "key-1",
  status: PendingVoucherStatus.PENDING,
  retryCount: 0,
  attemptedNumber: null,
  attemptedSalesPoint: null,
  payload: {},
};

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

interface QueueHarness {
  queue: PendingVoucherQueue;
  created: PendingVoucherData[];
  updates: { id: string; data: PendingVoucherUpdate }[];
  deleted: string[];
  dueQueries: Parameters<PendingVoucherTables["pendingVoucher"]["findMany"]>[0][];
  pushes: { issuerId: string; message: PushMessage }[];
  webhooks: { issuerId: string; event: string; payload: unknown }[];
}

function harness(createError?: Error): QueueHarness {
  const created: PendingVoucherData[] = [];
  const updates: QueueHarness["updates"] = [];
  const deleted: string[] = [];
  const dueQueries: QueueHarness["dueQueries"] = [];
  const pushes: QueueHarness["pushes"] = [];
  const dispatched: QueueHarness["webhooks"] = [];
  const tables: PendingVoucherTables = {
    issuer: { findUnique: ({ where }) => Promise.resolve(where.id === ISSUER.id ? ISSUER : null) },
    pendingVoucher: {
      create: ({ data }) => {
        if (createError !== undefined) {
          return Promise.reject(createError);
        }
        created.push(data);
        return Promise.resolve({
          ...EXISTING_ROW,
          id: "pending-new",
          idempotencyKey: data.idempotencyKey ?? null,
        });
      },
      findUnique: ({ where }) =>
        Promise.resolve(
          where.issuerId_idempotencyKey.idempotencyKey === EXISTING_ROW.idempotencyKey ? EXISTING_ROW : null,
        ),
      findMany: (args) => {
        dueQueries.push(args);
        return Promise.resolve([EXISTING_ROW]);
      },
      update: ({ where, data }) => {
        updates.push({ id: where.id, data });
        return Promise.resolve({});
      },
      delete: ({ where }) => {
        deleted.push(where.id);
        return Promise.resolve({});
      },
    },
  };
  const push: IssuerOwnerNotifier = {
    notifyIssuerOwner: (issuerId, message) => {
      pushes.push({ issuerId, message });
      return Promise.resolve();
    },
  };
  const webhookDispatcher: WebhookDispatcher = {
    dispatch: (issuerId, event, payload) => {
      dispatched.push({ issuerId, event, payload });
      return Promise.resolve();
    },
  };
  return {
    queue: new PendingVoucherQueue(tables, POLICY, push, webhookDispatcher),
    created,
    updates,
    deleted,
    dueQueries,
    pushes,
    webhooks: dispatched,
  };
}

function entry(
  overrides: { idempotencyKey?: string; attemptedNumber?: number | null } = {},
): Parameters<PendingVoucherQueue["enqueue"]>[0] {
  return {
    issuerId: ISSUER.id,
    input: buildInput(),
    idempotencyKey: overrides.idempotencyKey,
    lastError: "ARCA no respondió",
    attemptedNumber: overrides.attemptedNumber ?? null,
  };
}

beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PendingVoucherQueue.enqueue", () => {
  it("stores the payload for a first retry without an attempted number", async () => {
    const { queue, created } = harness();

    await queue.enqueue(entry());

    expect(created).toHaveLength(1);
    const [stored] = created;
    expect(stored?.payload).toEqual(
      expect.objectContaining({ issuerId: ISSUER.id, salesPoint: 1, voucherType: 11 }),
    );
    expect({ ...stored, payload: undefined }).toEqual({
      issuerId: ISSUER.id,
      payload: undefined,
      nextRetryAt: new Date(NOW + RETRY_BASE_MS),
      lastError: "ARCA no respondió",
      attemptedNumber: null,
      attemptedSalesPoint: null,
      attemptedAt: null,
    });
  });

  it("records the attempted number, its sales point and the idempotency key", async () => {
    const { queue, created } = harness();

    await queue.enqueue(entry({ idempotencyKey: "key-9", attemptedNumber: 7 }));

    expect(created[0]).toEqual(
      expect.objectContaining({
        idempotencyKey: "key-9",
        attemptedNumber: 7,
        attemptedSalesPoint: 1,
      }),
    );
    expect(created[0]?.attemptedAt).toBeInstanceOf(Date);
  });

  it("returns the already queued voucher when the idempotency key collides", async () => {
    const { queue } = harness(uniqueViolation());

    await expect(queue.enqueue(entry({ idempotencyKey: "key-1" }))).resolves.toBe(EXISTING_ROW);
  });

  it("rethrows a unique violation when there is no idempotency key to recover with", async () => {
    const violation = uniqueViolation();
    const { queue } = harness(violation);

    await expect(queue.enqueue(entry())).rejects.toBe(violation);
  });

  it("rethrows a collision whose queued voucher cannot be found", async () => {
    const violation = uniqueViolation();
    const { queue } = harness(violation);

    await expect(queue.enqueue(entry({ idempotencyKey: "unknown-key" }))).rejects.toBe(violation);
  });

  it("rethrows errors that are not unique violations", async () => {
    const failure = new Error("conexión perdida");
    const { queue } = harness(failure);

    await expect(queue.enqueue(entry({ idempotencyKey: "key-1" }))).rejects.toBe(failure);
  });
});

describe("PendingVoucherQueue lookups", () => {
  it("fetches pending vouchers due now in a bounded batch", async () => {
    const { queue, dueQueries } = harness();

    await expect(queue.findDue()).resolves.toEqual([EXISTING_ROW]);
    expect(dueQueries).toHaveLength(1);
    expect(dueQueries[0]?.where.status).toBe(PendingVoucherStatus.PENDING);
    expect(dueQueries[0]?.where.nextRetryAt.lte).toBeInstanceOf(Date);
    expect(dueQueries[0]?.take).toBe(25);
  });

  it("finds the issuer of a queued voucher", async () => {
    const { queue } = harness();

    await expect(queue.findIssuer(EXISTING_ROW)).resolves.toEqual(ISSUER);
    await expect(queue.findIssuer({ ...EXISTING_ROW, issuerId: "missing" })).resolves.toBeNull();
  });
});

describe("PendingVoucherQueue outcomes", () => {
  const issued: IssuedVoucher = {
    id: "voucher-1",
    voucherType: 11,
    salesPoint: 1,
    number: 8,
    cae: "74000000000001",
    caeExpiration: new Date(2026, 9, 4),
    netAmount: 100,
    ivaAmount: 0,
    totalAmount: 100,
    qrData: "qr",
  };

  it("removes a completed voucher from the queue and notifies the owner", async () => {
    const { queue, deleted, pushes } = harness();

    await queue.complete(EXISTING_ROW, issued);

    expect(deleted).toEqual([EXISTING_ROW.id]);
    expect(pushes).toEqual([{ issuerId: ISSUER.id, message: queuedVoucherAuthorizedMessage(issued) }]);
  });

  it("schedules the next retry with exponential backoff", async () => {
    const { queue, updates, webhooks } = harness();

    await queue.bump({ ...EXISTING_ROW, retryCount: 1 }, "timeout");

    expect(updates).toEqual([
      {
        id: EXISTING_ROW.id,
        data: { retryCount: 2, nextRetryAt: new Date(NOW + RETRY_BASE_MS * 4), lastError: "timeout" },
      },
    ]);
    expect(webhooks).toEqual([]);
  });

  it("fails the voucher once the retries are exhausted", async () => {
    const { queue, updates, webhooks, pushes } = harness();

    await queue.bump({ ...EXISTING_ROW, retryCount: MAX_RETRIES - 1 }, "timeout");

    expect(updates).toEqual([
      {
        id: EXISTING_ROW.id,
        data: { status: PendingVoucherStatus.FAILED, lastError: "timeout", retryCount: MAX_RETRIES },
      },
    ]);
    expect(webhooks).toEqual([
      {
        issuerId: ISSUER.id,
        event: WebhookEvent.VOUCHER_FAILED,
        payload: { pendingVoucherId: EXISTING_ROW.id, reason: "timeout", permanent: false, exhausted: true },
      },
    ]);
    expect(pushes).toEqual([
      { issuerId: ISSUER.id, message: queuedVoucherFailedMessage(EXISTING_ROW.id, "timeout") },
    ]);
  });

  it("flags a permanent failure as not exhausted", async () => {
    const { queue, webhooks } = harness();

    await queue.fail(EXISTING_ROW, "rechazado por ARCA", true);

    expect(webhooks).toEqual([
      expect.objectContaining({
        payload: {
          pendingVoucherId: EXISTING_ROW.id,
          reason: "rechazado por ARCA",
          permanent: true,
          exhausted: false,
        },
      }),
    ]);
  });
});
