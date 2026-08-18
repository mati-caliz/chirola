import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { IssuersService } from './issuers.service';
import { ArcaCallLogService } from '../arca/arca-call-log.service';

@Controller('issuers/:issuerId/arca-calls')
@UseGuards(JwtAuthGuard)
export class ArcaCallsController {
  constructor(
    private readonly callLog: ArcaCallLogService,
    private readonly issuers: IssuersService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
    @Query('operation') operation?: string,
    @Query('outcome') outcome?: string,
    @Query('limit') limit?: string,
  ) {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return this.callLog.listForIssuer(issuer.id, {
      operation,
      outcome,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':callId')
  async detail(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
    @Param('callId') callId: string,
  ) {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return this.callLog.getForIssuer(issuer.id, callId);
  }
}
