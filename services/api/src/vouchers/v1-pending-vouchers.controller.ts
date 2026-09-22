import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ServiceAuthGuard } from '../service-auth/service-auth.guard';
import { RateLimitGuard } from '../service-auth/rate-limit.guard';
import { ServiceAuditInterceptor } from '../service-auth/service-audit.interceptor';
import { CurrentApiClient } from '../service-auth/current-api-client.decorator';
import type { AuthenticatedApiClient } from '../service-auth/api-client.service';
import { PendingVouchersService } from './pending-vouchers.service';

@Controller('v1/pending-vouchers')
@UseGuards(ServiceAuthGuard, RateLimitGuard)
@UseInterceptors(ServiceAuditInterceptor)
export class V1PendingVouchersController {
  constructor(private readonly pendingVouchers: PendingVouchersService) {}

  @Get()
  list(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
  ) {
    return this.pendingVouchers.listForApiClient(apiClient, issuerId);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  retry(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
    @Param('id') id: string,
  ) {
    return this.pendingVouchers.retryForApiClient(apiClient, issuerId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  discard(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Query('issuerId') issuerId: string,
    @Param('id') id: string,
  ) {
    return this.pendingVouchers.discardForApiClient(apiClient, issuerId, id);
  }
}
