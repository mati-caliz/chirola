import type { FactoryProvider } from "@nestjs/common";
import type { Issuer, PendingVoucher, Prisma } from "@prisma/client";
import type { AssociatedVoucher } from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { ArcaObservation, ArcaTribute } from "../arca/wsfe/wsfe.types";
import type { StoredIssuer } from "./voucher-emission.types";

export const VOUCHER_TABLES = Symbol("VoucherTables");

type AmountValue = Prisma.Decimal | number;

type JsonRecord<Shape> = { [Key in keyof Shape]: Shape[Key] };

interface IssuerTable {
  findUnique(args: { where: { id: string } }): Promise<StoredIssuer | null>;
}

interface VoucherDetailInclude {
  items: true;
  client: true;
  salesPoint: true;
  issuer: true;
}

export type VoucherDetail = Prisma.VoucherGetPayload<{ include: VoucherDetailInclude }>;

export const VOUCHER_LIST_SELECT = {
  id: true,
  voucherType: true,
  number: true,
  voucherDate: true,
  status: true,
  cae: true,
  totalAmount: true,
  currency: true,
  recipientName: true,
  salesPoint: { select: { number: true } },
  client: { select: { legalName: true, docNumber: true } },
} as const;

export type VoucherListEntry = Prisma.VoucherGetPayload<{ select: typeof VOUCHER_LIST_SELECT }>;

export interface IssuerScope {
  id: string;
  userId?: string;
}

export type VoucherScope = { id: string; issuerId: string } | { id: string; issuer: { userId: string } };

export interface VoucherAccessTables {
  issuer: {
    findFirst(args: { where: IssuerScope }): Promise<StoredIssuer | null>;
    count(args: { where: { id: string } }): Promise<number>;
  };
  voucher: {
    findFirst(args: { where: VoucherScope; include: VoucherDetailInclude }): Promise<VoucherDetail | null>;
    findUnique(args: {
      where: { id: string };
      select: { issuerId: true };
    }): Promise<{ issuerId: string } | null>;
    findMany(args: {
      where: { issuerId: string };
      orderBy: Prisma.VoucherOrderByWithRelationInput[];
      take: number;
      select: typeof VOUCHER_LIST_SELECT;
    }): Promise<VoucherListEntry[]>;
  };
}

export interface EmissionPlanTables {
  issuer: {
    findUniqueOrThrow(args: {
      where: { id: string };
      select: { onboardingStatus: true };
    }): Promise<Pick<Issuer, "onboardingStatus">>;
  };
}

export interface IssuedVoucherItemData {
  description: string;
  quantity: number;
  unitPrice: number;
  ivaRate: number;
  taxTreatment: string;
  subtotal: number;
}

export interface IssuedVoucherData {
  issuerId: string;
  salesPointId: string;
  clientId: string | null;
  recipientDocType: number;
  recipientDocNumber: string;
  recipientName: string | null;
  voucherType: number;
  number: number;
  voucherDate: Date;
  concept: number;
  serviceFrom: Date | null;
  serviceTo: Date | null;
  paymentDueDate: Date | null;
  netAmount: number;
  ivaAmount: number;
  exemptAmount: number;
  untaxedAmount: number;
  tributeAmount: number;
  totalAmount: number;
  tributes?: JsonRecord<ArcaTribute>[];
  currency: string;
  exchangeRate: number;
  status: string;
  cae: string;
  caeExpiration: Date;
  arcaObservations?: JsonRecord<ArcaObservation>[];
  qrData: string;
  associatedVouchers?: AssociatedVoucher[];
  items: { create: IssuedVoucherItemData[] };
}

export interface ReplayableVoucher {
  id: string;
  voucherType: number;
  number: number;
  voucherDate: Date;
  cae: string | null;
  caeExpiration: Date | null;
  qrData: string | null;
  netAmount: AmountValue;
  ivaAmount: AmountValue;
  totalAmount: AmountValue;
  salesPoint: { number: number };
}

interface IssuerIdempotencyKey {
  issuerId_idempotencyKey: { issuerId: string; idempotencyKey: string };
}

export interface IssuedVoucherTables {
  salesPoint: {
    upsert(args: {
      where: { issuerId_number: { issuerId: string; number: number } };
      create: { issuerId: string; number: number };
      update: Record<string, never>;
    }): Promise<{ id: string }>;
  };
  client: {
    findUnique(args: {
      where: { issuerId_docType_docNumber: { issuerId: string; docType: number; docNumber: string } };
      select: { id: true; legalName: true };
    }): Promise<{ id: string; legalName: string | null } | null>;
  };
  voucher: {
    create(args: { data: IssuedVoucherData }): Promise<{ id: string }>;
    findUnique(args: {
      where: { id: string };
      include: { salesPoint: true };
    }): Promise<ReplayableVoucher | null>;
  };
  idempotencyRecord: {
    findUnique(args: {
      where: { issuerId_key: { issuerId: string; key: string } };
    }): Promise<{ voucherId: string } | null>;
    create(args: { data: { issuerId: string; key: string; voucherId: string } }): Promise<unknown>;
  };
  pendingVoucher: {
    findUnique(args: { where: IssuerIdempotencyKey }): Promise<{ id: string; status: string } | null>;
  };
}

export type PendingVoucherRow = Pick<
  PendingVoucher,
  "id" | "issuerId" | "idempotencyKey" | "status" | "retryCount" | "attemptedNumber" | "attemptedSalesPoint"
> & { payload: unknown };

export interface PendingVoucherData {
  issuerId: string;
  idempotencyKey?: string;
  payload: Prisma.InputJsonObject;
  nextRetryAt: Date;
  lastError: string;
  attemptedNumber: number | null;
  attemptedSalesPoint: number | null;
  attemptedAt: Date | null;
}

export interface PendingVoucherUpdate {
  status?: string;
  retryCount: number;
  nextRetryAt?: Date;
  lastError: string;
}

export interface PendingVoucherTables {
  issuer: IssuerTable;
  pendingVoucher: {
    create(args: { data: PendingVoucherData }): Promise<PendingVoucherRow>;
    findUnique(args: { where: IssuerIdempotencyKey }): Promise<PendingVoucherRow | null>;
    findMany(args: {
      where: { status: string; nextRetryAt: { lte: Date } };
      take: number;
    }): Promise<PendingVoucherRow[]>;
    update(args: { where: { id: string }; data: PendingVoucherUpdate }): Promise<unknown>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
}

export interface NumberingGroup {
  salesPointId: string;
  voucherType: number;
  _max: { number: number | null };
}

export interface NumberingTables {
  voucher: {
    groupBy(args: {
      by: ["salesPointId", "voucherType"];
      where: { issuerId: string };
      _max: { number: true };
    }): Promise<NumberingGroup[]>;
  };
  salesPoint: {
    findMany(args: { where: { issuerId: string } }): Promise<{ id: string; number: number }[]>;
  };
}

export type VoucherTables = VoucherAccessTables &
  EmissionPlanTables &
  IssuedVoucherTables &
  PendingVoucherTables &
  NumberingTables;

export const voucherTablesProvider: FactoryProvider<VoucherTables> = {
  provide: VOUCHER_TABLES,
  inject: [PrismaService],
  useFactory: (prisma: PrismaService): VoucherTables => prisma,
};
