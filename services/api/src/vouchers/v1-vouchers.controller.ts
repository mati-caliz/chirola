import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { issueVoucherSchema, type IssueVoucher } from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServiceAuthGuard } from '../service-auth/service-auth.guard';
import { CurrentApiClient } from '../service-auth/current-api-client.decorator';
import type { AuthenticatedApiClient } from '../service-auth/api-client.service';
import { VouchersService } from './vouchers.service';

@Controller('v1/vouchers')
@UseGuards(ServiceAuthGuard)
export class V1VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Post()
  issue(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Body(new ZodValidationPipe(issueVoucherSchema)) body: IssueVoucher,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.vouchers.issueForApiClient(apiClient, body, idempotencyKey);
  }

  @Get(':id')
  get(
    @CurrentApiClient() apiClient: AuthenticatedApiClient,
    @Param('id') id: string,
  ) {
    return this.vouchers.getForApiClient(apiClient, id);
  }
}
