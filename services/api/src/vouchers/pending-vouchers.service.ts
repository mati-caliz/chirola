import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PendingVoucher } from '@prisma/client';
import {
  issueVoucherSchema,
  PendingVoucherStatus,
  type PendingVoucherSummary,
} from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IssuersService } from '../issuers/issuers.service';
import {
  ApiClientService,
  type AuthenticatedApiClient,
} from '../service-auth/api-client.service';
import { calculateAmounts } from '../arca/wsfe/iva-calculator';

const NOT_FAILED_MESSAGE =
  'Sólo se puede reintentar o descartar un comprobante que falló: los que siguen en cola se reintentan solos.';

export function summarizePendingVoucher(pending: PendingVoucher): PendingVoucherSummary {
  const input = issueVoucherSchema.parse(pending.payload);
  const amounts = calculateAmounts(input.voucherType, input.items, input.tributes);
  return {
    id: pending.id,
    status: pending.status,
    voucherType: input.voucherType,
    salesPoint: input.salesPoint,
    recipientName: input.recipient.legalName ?? null,
    totalAmount: amounts.totalAmount,
    currency: input.currency,
    retryCount: pending.retryCount,
    nextRetryAt: pending.nextRetryAt.toISOString(),
    lastError: pending.lastError,
    createdAt: pending.createdAt.toISOString(),
  };
}

@Injectable()
export class PendingVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issuers: IssuersService,
    private readonly apiClients: ApiClientService,
  ) {}

  async listForUser(userId: string, issuerId: string): Promise<PendingVoucherSummary[]> {
    await this.issuers.getFromUser(issuerId, userId);
    return this.list(issuerId);
  }

  async retryForUser(userId: string, issuerId: string, id: string): Promise<void> {
    await this.issuers.getFromUser(issuerId, userId);
    await this.retry(issuerId, id);
  }

  async discardForUser(userId: string, issuerId: string, id: string): Promise<void> {
    await this.issuers.getFromUser(issuerId, userId);
    await this.discard(issuerId, id);
  }

  async listForApiClient(
    apiClient: AuthenticatedApiClient,
    issuerId: string,
  ): Promise<PendingVoucherSummary[]> {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    return this.list(issuerId);
  }

  async retryForApiClient(
    apiClient: AuthenticatedApiClient,
    issuerId: string,
    id: string,
  ): Promise<void> {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    await this.retry(issuerId, id);
  }

  async discardForApiClient(
    apiClient: AuthenticatedApiClient,
    issuerId: string,
    id: string,
  ): Promise<void> {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    await this.discard(issuerId, id);
  }

  private async list(issuerId: string): Promise<PendingVoucherSummary[]> {
    const pending = await this.prisma.pendingVoucher.findMany({
      where: { issuerId },
      orderBy: { createdAt: 'desc' },
    });
    return pending.map(summarizePendingVoucher);
  }

  private async retry(issuerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.pendingVoucher.updateMany({
      where: { id, issuerId, status: PendingVoucherStatus.FAILED },
      data: {
        status: PendingVoucherStatus.PENDING,
        retryCount: 0,
        nextRetryAt: new Date(),
      },
    });
    if (count === 0) {
      await this.explainMissingFailed(issuerId, id);
    }
  }

  private async discard(issuerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.pendingVoucher.deleteMany({
      where: { id, issuerId, status: PendingVoucherStatus.FAILED },
    });
    if (count === 0) {
      await this.explainMissingFailed(issuerId, id);
    }
  }

  private async explainMissingFailed(issuerId: string, id: string): Promise<never> {
    const existing = await this.prisma.pendingVoucher.findFirst({
      where: { id, issuerId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Comprobante en cola inexistente.');
    }
    throw new ConflictException(NOT_FAILED_MESSAGE);
  }
}
