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
} from "./voucher-tables";

const DEFAULT_VOUCHER_LIST_LIMIT = 20;
const MAX_VOUCHER_LIST_LIMIT = 100;

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

  async findIssuer(issuerId: string): Promise<StoredIssuer> {
    const issuer = await this.tables.issuer.findUnique({ where: { id: issuerId } });
    if (!issuer) {
      throw new NotFoundException("Emisor inexistente.");
    }
    return issuer;
  }

  async findOwnedIssuer(userId: string, issuerId: string): Promise<StoredIssuer> {
    const issuer = await this.findIssuer(issuerId);
    if (issuer.userId !== userId) {
      throw new ForbiddenException("El emisor no pertenece al usuario.");
    }
    return issuer;
  }

  async assertGranted(apiClient: AuthenticatedApiClient, issuerId: string): Promise<void> {
    await this.grants.assertIssuerGranted(apiClient.id, issuerId);
  }

  async get(userId: string, id: string): Promise<VoucherDetail> {
    const voucher = await this.loadVoucher(id);
    if (voucher.issuer.userId !== userId) {
      throw new ForbiddenException("El comprobante no pertenece al usuario.");
    }
    return voucher;
  }

  async getForApiClient(apiClient: AuthenticatedApiClient, id: string): Promise<VoucherDetail> {
    const voucher = await this.loadVoucher(id);
    await this.assertGranted(apiClient, voucher.issuerId);
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

  private async loadVoucher(id: string): Promise<VoucherDetail> {
    const voucher = await this.tables.voucher.findUnique({
      where: { id },
      include: { items: true, client: true, salesPoint: true, issuer: true },
    });
    if (!voucher) {
      throw new NotFoundException("Comprobante inexistente.");
    }
    return voucher;
  }
}
