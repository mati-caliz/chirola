import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  emitirComprobanteSchema,
  type EmitirComprobante,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { ComprobantesService } from './comprobantes.service';

@Controller('comprobantes')
@UseGuards(JwtAuthGuard)
export class ComprobantesController {
  constructor(private readonly comprobantes: ComprobantesService) {}

  /** Emite un comprobante contra ARCA y devuelve el CAE + QR. */
  @Post()
  emitir(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(emitirComprobanteSchema))
    body: EmitirComprobante,
  ) {
    return this.comprobantes.emitir(user.sub, body);
  }

  @Get(':id')
  obtener(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.comprobantes.obtener(user.sub, id);
  }
}
