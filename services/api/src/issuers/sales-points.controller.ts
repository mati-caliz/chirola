import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { updateSalesPointSchema, type UpdateSalesPoint } from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { SalesPointsService } from './sales-points.service';

@Controller('issuers/:issuerId/sales-points')
@UseGuards(JwtAuthGuard)
export class SalesPointsController {
  constructor(private readonly salesPoints: SalesPointsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('issuerId') issuerId: string) {
    return this.salesPoints.list(user.sub, issuerId);
  }

  @Post('sync')
  sync(@CurrentUser() user: JwtPayload, @Param('issuerId') issuerId: string) {
    return this.salesPoints.sync(user.sub, issuerId);
  }

  @Patch(':number')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
    @Param('number') number: string,
    @Body(new ZodValidationPipe(updateSalesPointSchema)) body: UpdateSalesPoint,
  ) {
    return this.salesPoints.updateDescription(user.sub, issuerId, Number(number), body.description);
  }
}
