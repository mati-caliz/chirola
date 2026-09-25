import { fakeIssuerAuth, fakeIssuerOnboarding } from "../issuer-arca/issuer-arca.fixture";
import { issueVoucherSchema, PendingVoucherStatus, type IssueVoucher } from "@chirola/shared";
import { VouchersService } from "./vouchers.service";
import { IssuerLockService } from "./issuer-lock.service";
import { VoucherAccessService } from "./voucher-access.service";
import { VoucherEmissionService } from "./voucher-emission.service";
import { EmissionPlanService } from "./emission-plan.service";
import { CaeRequestService } from "./cae-request.service";
import { IssuedVoucherRecorder } from "./issued-voucher-recorder.service";
import { PendingVoucherQueue } from "./pending-voucher-queue.service";
import { PendingVoucherRetryService } from "./pending-voucher-retry.service";
import type { StoredIssuer } from "./voucher-emission.types";
import type {
  IssuerGrants,
  IssuerOwnerNotifier,
  VoucherRetryPolicy,
  WebhookDispatcher,
  WsfeGateway,
} from "./voucher-ports";
import type {
  EmissionPlanTables,
  IssuedVoucherData,
  IssuedVoucherTables,
  PendingVoucherRow,
  PendingVoucherTables,
  ReplayableVoucher,
  VoucherAccessTables,
} from "./voucher-tables";

export interface StoredVoucher extends ReplayableVoucher {
  issuerId: string;
  salesPointId: string;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  status: string;
  arcaObservations: NonNullable<IssuedVoucherData["arcaObservations"]> | null;
}

export interface PendingRow extends PendingVoucherRow {
  nextRetryAt: Date;
}

type MockedMethod<Method extends (...args: never[]) => unknown> = jest.Mock<
  ReturnType<Method>,
  Parameters<Method>
>;

interface WsfeDouble {
  getLastAuthorized: MockedMethod<WsfeGateway["getLastAuthorized"]>;
  requestCae: MockedMethod<WsfeGateway["requestCae"]>;
  queryVoucher: MockedMethod<WsfeGateway["queryVoucher"]>;
  queryVoucherDetail: MockedMethod<WsfeGateway["queryVoucherDetail"]>;
}

export interface Harness {
  service: VouchersService;
  retries: PendingVoucherRetryService;
  wsfe: WsfeDouble;
  vouchers: StoredVoucher[];
  pending: PendingRow[];
  webhooks: { dispatch: MockedMethod<WebhookDispatcher["dispatch"]> };
  push: { notifyIssuerOwner: MockedMethod<IssuerOwnerNotifier["notifyIssuerOwner"]> };
}

interface IdempotencyRow {
  issuerId: string;
  key: string;
  voucherId: string;
}

const ISSUER: StoredIssuer = {
  id: "issuer-1",
  userId: "user-1",
  cuit: "20111111112",
  environment: "homologacion",
  representativeCuit: null,
  cbu: null,
  paymentAlias: null,
};

const RETRY_POLICY: VoucherRetryPolicy = { maxRetries: 8, retryBaseMs: 0 };
const STORED_SALES_POINT = 1;
const ISSUED_CAE = {
  cae: "74000000000001",
  caeVto: new Date("2026-07-22"),
  observations: [],
};

export function buildInput(): IssueVoucher {
  return issueVoucherSchema.parse({
    issuerId: ISSUER.id,
    salesPoint: 1,
    voucherType: 11,
    concept: 1,
    currency: "PES",
    exchangeRate: 1,
    recipient: { docType: 99, docNumber: "0", ivaConditionId: 5 },
    items: [{ description: "Item", quantity: 1, unitPrice: 100, ivaRate: 0 }],
  });
}

function notUsed(): Promise<never> {
  return Promise.reject(new Error("No se usa en estos tests."));
}

function storedVoucherFrom(id: string, data: IssuedVoucherData): StoredVoucher {
  return {
    id,
    issuerId: data.issuerId,
    salesPointId: data.salesPointId,
    voucherType: data.voucherType,
    number: data.number,
    voucherDate: data.voucherDate,
    netAmount: data.netAmount,
    ivaAmount: data.ivaAmount,
    totalAmount: data.totalAmount,
    cae: data.cae,
    caeExpiration: data.caeExpiration,
    qrData: data.qrData,
    status: data.status,
    arcaObservations: data.arcaObservations ?? null,
    salesPoint: { number: STORED_SALES_POINT },
  };
}

function buildPendingTables(pending: PendingRow[]): PendingVoucherTables {
  const findByKey: PendingVoucherTables["pendingVoucher"]["findUnique"] = ({ where }) =>
    Promise.resolve(
      pending.find(
        (row) =>
          row.issuerId === where.issuerId_idempotencyKey.issuerId &&
          row.idempotencyKey === where.issuerId_idempotencyKey.idempotencyKey,
      ) ?? null,
    );
  return {
    issuer: { findUnique: () => Promise.resolve(ISSUER) },
    pendingVoucher: {
      findUnique: findByKey,
      create: ({ data }) => {
        const row: PendingRow = {
          id: `pending-${pending.length + 1}`,
          issuerId: data.issuerId,
          idempotencyKey: data.idempotencyKey ?? null,
          payload: data.payload,
          status: PendingVoucherStatus.PENDING,
          retryCount: 0,
          attemptedNumber: data.attemptedNumber,
          attemptedSalesPoint: data.attemptedSalesPoint,
          nextRetryAt: data.nextRetryAt,
        };
        pending.push(row);
        return Promise.resolve(row);
      },
      findMany: ({ where }) =>
        Promise.resolve(
          pending.filter(
            (row) =>
              row.status === where.status && row.nextRetryAt.getTime() <= where.nextRetryAt.lte.getTime(),
          ),
        ),
      update: ({ where, data }) => {
        const row = pending.find((pendingRow) => pendingRow.id === where.id);
        if (row) Object.assign(row, data);
        return Promise.resolve(row);
      },
      delete: ({ where }) => {
        const index = pending.findIndex((pendingRow) => pendingRow.id === where.id);
        if (index >= 0) pending.splice(index, 1);
        return Promise.resolve({});
      },
    },
  };
}

function buildRecorderTables(
  vouchers: StoredVoucher[],
  pendingTables: PendingVoucherTables,
): IssuedVoucherTables {
  const idempotency: IdempotencyRow[] = [];
  return {
    salesPoint: { upsert: ({ where }) => Promise.resolve({ id: `sp-${where.issuerId_number.number}` }) },
    client: { findUnique: () => Promise.resolve(null) },
    voucher: {
      create: ({ data }) => {
        const stored = storedVoucherFrom(`voucher-${vouchers.length + 1}`, data);
        vouchers.push(stored);
        return Promise.resolve(stored);
      },
      findUnique: ({ where }) => Promise.resolve(vouchers.find((voucher) => voucher.id === where.id) ?? null),
    },
    idempotencyRecord: {
      findUnique: ({ where }) =>
        Promise.resolve(
          idempotency.find(
            (record) =>
              record.issuerId === where.issuerId_key.issuerId && record.key === where.issuerId_key.key,
          ) ?? null,
        ),
      create: ({ data }) => {
        idempotency.push(data);
        return Promise.resolve(data);
      },
    },
    pendingVoucher: { findUnique: (args) => pendingTables.pendingVoucher.findUnique(args) },
  };
}

function buildWsfe(vouchers: StoredVoucher[]): WsfeDouble {
  const lastAuthorized: WsfeGateway["getLastAuthorized"] = (_auth, salesPoint, voucherType) =>
    Promise.resolve(
      vouchers
        .filter(
          (storedVoucher) =>
            storedVoucher.voucherType === voucherType && storedVoucher.salesPoint.number === salesPoint,
        )
        .reduce((max, storedVoucher) => Math.max(max, storedVoucher.number), 0),
    );
  const requestCae: WsfeGateway["requestCae"] = () => Promise.resolve(ISSUED_CAE);
  const queryVoucher: WsfeGateway["queryVoucher"] = () => Promise.resolve(null);
  const queryVoucherDetail: WsfeGateway["queryVoucherDetail"] = () => Promise.resolve(null);
  return {
    getLastAuthorized: jest.fn(lastAuthorized),
    requestCae: jest.fn(requestCae),
    queryVoucher: jest.fn(queryVoucher),
    queryVoucherDetail: jest.fn(queryVoucherDetail),
  };
}

export function buildHarness(): Harness {
  const vouchers: StoredVoucher[] = [];
  const pending: PendingRow[] = [];
  const pendingTables = buildPendingTables(pending);
  const wsfe = buildWsfe(vouchers);
  const dispatch: WebhookDispatcher["dispatch"] = () => Promise.resolve();
  const notifyIssuerOwner: IssuerOwnerNotifier["notifyIssuerOwner"] = () => Promise.resolve();
  const webhooks = { dispatch: jest.fn(dispatch) };
  const push = { notifyIssuerOwner: jest.fn(notifyIssuerOwner) };
  const grants: IssuerGrants = { assertIssuerGranted: () => Promise.resolve() };
  const accessTables: VoucherAccessTables = {
    issuer: pendingTables.issuer,
    voucher: { findUnique: notUsed, findMany: notUsed },
  };
  const planTables: EmissionPlanTables = { issuer: { findUniqueOrThrow: notUsed } };

  const issuerLock = new IssuerLockService();
  const caeRequests = new CaeRequestService(fakeIssuerAuth(), fakeIssuerOnboarding(), wsfe);
  const recorder = new IssuedVoucherRecorder(buildRecorderTables(vouchers, pendingTables), webhooks);
  const queue = new PendingVoucherQueue(pendingTables, RETRY_POLICY, push, webhooks);
  const service = new VouchersService(
    new VoucherAccessService(accessTables, grants),
    new VoucherEmissionService(issuerLock, caeRequests, recorder, queue),
    new EmissionPlanService(planTables, fakeIssuerAuth(), fakeIssuerOnboarding(), wsfe),
  );
  const retries = new PendingVoucherRetryService(issuerLock, caeRequests, recorder, queue);

  return { service, retries, wsfe, vouchers, pending, webhooks, push };
}
