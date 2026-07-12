import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  actualizarClienteSchema,
  crearClienteSchema,
  type ActualizarCliente,
  type CrearCliente,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { EmisoresService } from '../emisores/emisores.service';
import { ClientesService } from './clientes.service';

/** ABM de clientes de un emisor propio. */
@Controller('emisores/:emisorId/clientes')
@UseGuards(JwtAuthGuard)
export class ClientesController {
  constructor(
    private readonly clientes: ClientesService,
    private readonly emisores: EmisoresService,
  ) {}

  /** Verifica que el emisor exista y sea del usuario del token. */
  private async assertEmisor(emisorId: string, user: JwtPayload) {
    await this.emisores.obtenerDeUsuario(emisorId, user.sub);
  }

  @Post()
  async crear(
    @CurrentUser() user: JwtPayload,
    @Param('emisorId') emisorId: string,
    @Body(new ZodValidationPipe(crearClienteSchema)) body: CrearCliente,
  ) {
    await this.assertEmisor(emisorId, user);
    return this.clientes.crear(emisorId, body);
  }

  @Get()
  async listar(
    @CurrentUser() user: JwtPayload,
    @Param('emisorId') emisorId: string,
  ) {
    await this.assertEmisor(emisorId, user);
    return this.clientes.listar(emisorId);
  }

  @Get(':id')
  async obtener(
    @CurrentUser() user: JwtPayload,
    @Param('emisorId') emisorId: string,
    @Param('id') id: string,
  ) {
    await this.assertEmisor(emisorId, user);
    return this.clientes.obtener(emisorId, id);
  }

  @Patch(':id')
  async actualizar(
    @CurrentUser() user: JwtPayload,
    @Param('emisorId') emisorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarClienteSchema)) body: ActualizarCliente,
  ) {
    await this.assertEmisor(emisorId, user);
    return this.clientes.actualizar(emisorId, id, body);
  }

  @Delete(':id')
  async eliminar(
    @CurrentUser() user: JwtPayload,
    @Param('emisorId') emisorId: string,
    @Param('id') id: string,
  ) {
    await this.assertEmisor(emisorId, user);
    return this.clientes.eliminar(emisorId, id);
  }
}
