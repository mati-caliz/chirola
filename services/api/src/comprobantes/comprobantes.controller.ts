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

  @Get(':id/qr.png')
  async qr(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const png = await this.comprobantes.renderQrPng(user.sub, id);
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
    const pdf = await this.comprobantes.renderPdf(user.sub, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="comprobante-${id}.pdf"`,
    );
    res.end(pdf);
  }
}
