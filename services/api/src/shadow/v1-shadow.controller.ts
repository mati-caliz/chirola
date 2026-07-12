import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { shadowCompareSchema, type ShadowCompareInput } from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServiceAuthGuard } from '../service-auth/service-auth.guard';
import { RateLimitGuard } from '../service-auth/rate-limit.guard';
import { CurrentApiClient } from '../service-auth/current-api-client.decorator';
import type { AuthenticatedApiClient } from '../service-auth/api-client.service';
import { ShadowService } from './shadow.service';

@Controller('v1/shadow')
@UseGuards(ServiceAuthGuard, RateLimitGuard)
export class V1ShadowController {
  constructor(private readonly shadow: ShadowService) {}

  @Post('compare')
  compare(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(shadowCompareSchema)) body: ShadowCompareInput,
  ) {
    return this.shadow.compare(apiClient, body);
  }

  @Get('summary')
  summary(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
  ) {
    return this.shadow.summary(apiClient, issuerId);
  }
}
