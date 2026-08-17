import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { IssuersService } from '../issuers/issuers.service';
import { ReconciliationService } from './reconciliation.service';

@Controller('issuers/:issuerId/reconciliation')
@UseGuards(JwtAuthGuard)
export class ReconciliationController {
  constructor(
    private readonly reconciliation: ReconciliationService,
    private readonly issuers: IssuersService,
  ) {}

  @Get('numbering')
  async numbering(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
  ) {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return this.reconciliation.checkNumbering(issuer);
  }
}
