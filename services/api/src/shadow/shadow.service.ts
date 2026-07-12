import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ShadowCompareInput } from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ApiClientService } from '../service-auth/api-client.service';
import {
  VouchersService,
  type EmissionPlan,
} from '../vouchers/vouchers.service';
import type { AuthenticatedApiClient } from '../service-auth/api-client.service';

const MONEY_TOLERANCE = 0.01;
const SUMMARY_WINDOW = 200;

export interface Difference {
  field: string;
  expected: number;
  computed: number;
}

@Injectable()
export class ShadowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vouchers: VouchersService,
    private readonly apiClients: ApiClientService,
  ) {}

  async compare(apiClient: AuthenticatedApiClient, input: ShadowCompareInput) {
    const computed = await this.vouchers.computeEmissionPlanForApiClient(
      apiClient,
      input.voucher,
    );
    const differences = this.diff(input.expected, computed);
    const matched = differences.length === 0;

    await this.prisma.shadowComparison.create({
      data: {
        apiClientId: apiClient.id,
        issuerId: input.voucher.issuerId,
        salesPoint: computed.salesPoint,
        voucherType: computed.voucherType,
        matched,
        differences: differences as unknown as Prisma.InputJsonValue,
        expected: input.expected as unknown as Prisma.InputJsonValue,
        computed: computed as unknown as Prisma.InputJsonValue,
      },
    });

    return { matched, differences, computed };
  }

  async summary(apiClient: AuthenticatedApiClient, issuerId: string) {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    const recent = await this.prisma.shadowComparison.findMany({
      where: { issuerId },
      orderBy: { createdAt: 'desc' },
      take: SUMMARY_WINDOW,
    });
    const total = recent.length;
    const matched = recent.filter((row) => row.matched).length;
    return {
      total,
      matched,
      mismatched: total - matched,
      matchRate: total === 0 ? null : Math.round((matched / total) * 10000) / 100,
    };
  }

  private diff(
    expected: ShadowCompareInput['expected'],
    computed: EmissionPlan,
  ): Difference[] {
    const differences: Difference[] = [];
    if (
      expected.number !== undefined &&
      expected.number !== computed.number
    ) {
      differences.push({
        field: 'number',
        expected: expected.number,
        computed: computed.number,
      });
    }
    this.compareMoney(differences, 'netAmount', expected.netAmount, computed.netAmount);
    this.compareMoney(differences, 'ivaAmount', expected.ivaAmount, computed.ivaAmount);
    this.compareMoney(
      differences,
      'totalAmount',
      expected.totalAmount,
      computed.totalAmount,
    );
    return differences;
  }

  private compareMoney(
    differences: Difference[],
    field: string,
    expected: number,
    computed: number,
  ): void {
    if (Math.abs(expected - computed) > MONEY_TOLERANCE) {
      differences.push({ field, expected, computed });
    }
  }
}
