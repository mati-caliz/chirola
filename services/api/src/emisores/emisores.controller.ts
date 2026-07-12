import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  cargarCertificadoSchema,
  crearEmisorSchema,
  type CargarCertificado,
  type CrearEmisor,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { EmisoresService } from './emisores.service';
import { CertsService } from '../certs/certs.service';

@Controller('emisores')
@UseGuards(JwtAuthGuard)
export class EmisoresController {
  constructor(
    private readonly emisores: EmisoresService,
    private readonly certs: CertsService,
  ) {}

  @Post()
  crear(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(crearEmisorSchema)) body: CrearEmisor,
  ) {
    return this.emisores.crear(user.sub, body);
  }

  @Get()
  listar(@CurrentUser() user: JwtPayload) {
    return this.emisores.listar(user.sub);
  }

  /** Carga (o reemplaza) el certificado ARCA de un emisor propio. */
  @Post(':id/certificado')
  async cargarCertificado(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cargarCertificadoSchema))
    body: CargarCertificado,
  ) {
    await this.emisores.obtenerDeUsuario(id, user.sub);
    await this.certs.guardarCertificado(
      id,
      body.privateKeyPem,
      body.certPem,
      body.alias,
    );
    return { ok: true };
  }
}
