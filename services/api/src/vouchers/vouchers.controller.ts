import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  issueVoucherSchema,
  type IssueVoucher,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { VouchersService } from './vouchers.service';

@Controller('vouchers')
@UseGuards(JwtAuthGuard)
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Post()
  issue(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(issueVoucherSchema))
    body: IssueVoucher,
  ) {
    return this.vouchers.issue(user.sub, body);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.vouchers.get(user.sub, id);
  }

  @Get(':id/qr.png')
  async qr(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const png = await this.vouchers.buildQrPngBuffer(user.sub, id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(png);
  }

  @Get(':id/pdf')
  async pdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.vouchers.renderPdf(user.sub, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="voucher-${id}.pdf"`,
    );
    res.end(pdf);
  }
}
