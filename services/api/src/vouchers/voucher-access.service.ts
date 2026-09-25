import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ApiClientService, type AuthenticatedApiClient } from "../service-auth/api-client.service";
import type { IssuerGrants } from "./voucher-ports";
import type { StoredIssuer } from "./voucher-emission.types";
import {
  VOUCHER_LIST_SELECT,
  VOUCHER_TABLES,
  type VoucherAccessTables,
  type VoucherDetail,
  type VoucherListEntry,
  type VoucherScope,
} from "./voucher-tables";

const DEFAULT_VOUCHER_LIST_LIMIT = 20;
const MAX_VOUCHER_LIST_LIMIT = 100;
const MISSING_ISSUER_MESSAGE = "Emisor inexistente.";
const FOREIGN_ISSUER_MESSAGE = "El emisor no pertenece al usuario.";
const MISSING_VOUCHER_MESSAGE = "Comprobante inexistente.";
const FOREIGN_VOUCHER_MESSAGE = "El comprobante no pertenece al usuario.";
const VOUCHER_DETAIL_INCLUDE = { items: true, client: true, salesPoint: true, issuer: true } as const;

function listLimit(limit: number | undefined): number {
  return limit === undefined || !Number.isFinite(limit) || limit < 1
    ? DEFAULT_VOUCHER_LIST_LIMIT
    : Math.min(Math.trunc(limit), MAX_VOUCHER_LIST_LIMIT);
}

@Injectable()
export class VoucherAccessService {
  constructor(
    @Inject(VOUCHER_TABLES) private readonly tables: VoucherAccessTables,
    @Inject(ApiClientService) private readonly grants: IssuerGrants,
  ) {}

  async assertIssuerExists(issuerId: string): Promise<void> {
    if ((await this.tables.issuer.count({ where: { id: issuerId } })) === 0) {
      throw new NotFoundException(MISSING_ISSUER_MESSAGE);
    }
  }

  async findOwnedIssuer(userId: string, issuerId: string): Promise<StoredIssuer> {
    const issuer = await this.tables.issuer.findFirst({ where: { id: issuerId, userId } });
    if (issuer) {
      return issuer;
    }
    await this.assertIssuerExists(issuerId);
    throw new ForbiddenException(FOREIGN_ISSUER_MESSAGE);
  }

  async findGrantedIssuer(apiClient: AuthenticatedApiClient, issuerId: string): Promise<StoredIssuer> {
    await this.assertGranted(apiClient, issuerId);
    const issuer = await this.tables.issuer.findFirst({ where: { id: issuerId } });
    if (!issuer) {
      throw new NotFoundException(MISSING_ISSUER_MESSAGE);
    }
    return issuer;
  }

  async assertGranted(apiClient: AuthenticatedApiClient, issuerId: string): Promise<void> {
    await this.grants.assertIssuerGranted(apiClient.id, issuerId);
  }

  async get(userId: string, id: string): Promise<VoucherDetail> {
    const voucher = await this.findScopedVoucher({ id, issuer: { userId } });
    if (voucher) {
      return voucher;
    }
    await this.findVoucherIssuerId(id);
    throw new ForbiddenException(FOREIGN_VOUCHER_MESSAGE);
  }

  async getForApiClient(apiClient: AuthenticatedApiClient, id: string): Promise<VoucherDetail> {
    const issuerId = await this.findVoucherIssuerId(id);
    await this.assertGranted(apiClient, issuerId);
    const voucher = await this.findScopedVoucher({ id, issuerId });
    if (!voucher) {
      throw new NotFoundException(MISSING_VOUCHER_MESSAGE);
    }
    return voucher;
  }

  listForIssuer(issuerId: string, limit?: number): Promise<VoucherListEntry[]> {
    return this.tables.voucher.findMany({
      where: { issuerId },
      orderBy: [{ voucherDate: "desc" }, { number: "desc" }],
      take: listLimit(limit),
      select: VOUCHER_LIST_SELECT,
    });
  }

  private findScopedVoucher(where: VoucherScope): Promise<VoucherDetail | null> {
    return this.tables.voucher.findFirst({ where, include: VOUCHER_DETAIL_INCLUDE });
  }

  private async findVoucherIssuerId(id: string): Promise<string> {
    const owner = await this.tables.voucher.findUnique({ where: { id }, select: { issuerId: true } });
    if (!owner) {
      throw new NotFoundException(MISSING_VOUCHER_MESSAGE);
    }
    return owner.issuerId;
  }
}
