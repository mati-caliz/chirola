import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { VouchersService } from './vouchers.service';

@Controller('issuers/:issuerId/vouchers')
@UseGuards(JwtAuthGuard)
export class IssuerVouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('issuerId') issuerId: string) {
    return this.vouchers.listByIssuer(user.sub, issuerId);
  }
}
