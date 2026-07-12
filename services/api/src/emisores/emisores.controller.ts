import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  cargarCertificadoSchema,
  crearEmisorSchema,
  emparejarCertSchema,
  generarCsrSchema,
  type CargarCertificado,
  type CrearEmisor,
  type EmparejarCert,
  type GenerarCsr,
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

  /**
   * Genera un par de claves + CSR para el emisor y guarda la clave privada
   * cifrada. Devuelve el CSR para subir a ARCA (paso 1 del onboarding).
   */
  @Post(':id/csr')
  async generarCsr(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(generarCsrSchema)) body: GenerarCsr,
  ) {
    const emisor = await this.emisores.obtenerDeUsuario(id, user.sub);
    return this.certs.generarCsr(
      id,
      emisor.cuit,
      emisor.razonSocial,
      body.alias,
    );
  }

  /**
   * Empareja el `.crt` descargado de ARCA con la clave privada ya generada
   * (paso 4 del onboarding). No recibe la clave privada.
   */
  @Put(':id/certificado')
  async emparejarCertificado(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(emparejarCertSchema)) body: EmparejarCert,
  ) {
    await this.emisores.obtenerDeUsuario(id, user.sub);
    await this.certs.emparejarCert(id, body.certPem);
    return { ok: true };
  }

  /**
   * Carga (o reemplaza) el certificado ARCA de un emisor propio trayendo la
   * clave privada desde afuera (flujo manual, para quien ya tiene su par).
   */
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
