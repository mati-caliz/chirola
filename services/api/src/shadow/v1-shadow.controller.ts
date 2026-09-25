import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { EmissionPlan, shadowCompareSchema, type ShadowCompareInput } from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ServiceAuthGuard } from "../service-auth/service-auth.guard";
import { RateLimitGuard } from "../service-auth/rate-limit.guard";
import { CurrentApiClient } from "../service-auth/current-api-client.decorator";
import type { AuthenticatedApiClient } from "../service-auth/api-client.service";
import { Difference, ShadowService } from "./shadow.service";

@Controller("v1/shadow")
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1ShadowController {
  constructor(private readonly shadow: ShadowService) {}

  @Post("compare")
  compare(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(shadowCompareSchema)) body: ShadowCompareInput,
  ): Promise<{ matched: boolean; differences: Difference[]; computed: EmissionPlan }> {
    return this.shadow.compare(apiClient, body);
  }

  @Get("summary")
  summary(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query("issuerId") issuerId: string,
  ): Promise<{ total: number; matched: number; mismatched: number; matchRate: number | null }> {
    return this.shadow.summary(apiClient, issuerId);
  }
}
