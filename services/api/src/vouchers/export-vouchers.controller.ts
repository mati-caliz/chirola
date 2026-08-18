import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  issueExportVoucherSchema,
  type IssueExportVoucher,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { ExportVouchersService } from './export-vouchers.service';

@Controller('export-vouchers')
@UseGuards(JwtAuthGuard)
export class ExportVouchersController {
  constructor(private readonly exportVouchers: ExportVouchersService) {}

  @Post()
  issue(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(issueExportVoucherSchema))
    body: IssueExportVoucher,
  ) {
    return this.exportVouchers.issue(user.sub, body);
  }
}
