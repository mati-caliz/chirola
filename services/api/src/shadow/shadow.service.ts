import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { EmissionPlan, ShadowCompareInput } from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ApiClientService } from "../service-auth/api-client.service";
import { VouchersService } from "../vouchers/vouchers.service";
import type { AuthenticatedApiClient } from "../service-auth/api-client.service";

const MONEY_TOLERANCE = 0.01;
const SUMMARY_WINDOW = 200;
const BASIS_POINTS_PER_UNIT = 10_000;
const BASIS_POINTS_PER_PERCENT = 100;

export type EmissionPlanner = Pick<VouchersService, "computeEmissionPlanForApiClient">;
export type IssuerGrantChecker = Pick<ApiClientService, "assertIssuerGranted">;

export interface Difference {
  field: string;
  expected: number;
  computed: number;
}

function differencesAsJson(differences: Difference[]): Prisma.InputJsonValue {
  return differences.map(({ field, expected, computed }) => ({ field, expected, computed }));
}

function emissionPlanAsJson(plan: EmissionPlan): Prisma.InputJsonObject {
  return { ...plan, verification: { ...plan.verification } };
}

function matchRatePercent(matched: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((matched / total) * BASIS_POINTS_PER_UNIT) / BASIS_POINTS_PER_PERCENT;
}

@Injectable()
export class ShadowService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VouchersService) private readonly vouchers: EmissionPlanner,
    @Inject(ApiClientService) private readonly apiClients: IssuerGrantChecker,
  ) {}

  async compare(
    apiClient: AuthenticatedApiClient,
    input: ShadowCompareInput,
  ): Promise<{ matched: boolean; differences: Difference[]; computed: EmissionPlan }> {
    const computed = await this.vouchers.computeEmissionPlanForApiClient(apiClient, input.voucher);
    const differences = this.diff(input.expected, computed);
    const matched = differences.length === 0;

    await this.prisma.shadowComparison.create({
      data: {
        apiClientId: apiClient.id,
        issuerId: input.voucher.issuerId,
        salesPoint: computed.salesPoint,
        voucherType: computed.voucherType,
        matched,
        differences: differencesAsJson(differences),
        expected: input.expected,
        computed: emissionPlanAsJson(computed),
      },
    });

    return { matched, differences, computed };
  }

  async summary(
    apiClient: AuthenticatedApiClient,
    issuerId: string,
  ): Promise<{ total: number; matched: number; mismatched: number; matchRate: number | null }> {
    await this.apiClients.assertIssuerGranted(apiClient.id, issuerId);
    const recent = await this.prisma.shadowComparison.findMany({
      where: { issuerId },
      orderBy: { createdAt: "desc" },
      take: SUMMARY_WINDOW,
    });
    const total = recent.length;
    const matched = recent.filter((row) => row.matched).length;
    return {
      total,
      matched,
      mismatched: total - matched,
      matchRate: matchRatePercent(matched, total),
    };
  }

  private diff(expected: ShadowCompareInput["expected"], computed: EmissionPlan): Difference[] {
    const differences: Difference[] = [];
    if (expected.number !== undefined && expected.number !== computed.number) {
      differences.push({
        field: "number",
        expected: expected.number,
        computed: computed.number,
      });
    }
    this.compareMoney(differences, "netAmount", expected.netAmount, computed.netAmount);
    this.compareMoney(differences, "ivaAmount", expected.ivaAmount, computed.ivaAmount);
    this.compareMoney(differences, "totalAmount", expected.totalAmount, computed.totalAmount);
    return differences;
  }

  private compareMoney(differences: Difference[], field: string, expected: number, computed: number): void {
    if (Math.abs(expected - computed) > MONEY_TOLERANCE) {
      differences.push({ field, expected, computed });
    }
  }
}
