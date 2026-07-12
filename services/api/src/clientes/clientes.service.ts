import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ActualizarCliente, CrearCliente } from '@chirola/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ABM de clientes/receptores de un emisor. El ownership (que el emisor sea del
 * usuario) lo resuelve el controller vía EmisoresService antes de llamar acá.
 */
@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(emisorId: string, input: CrearCliente) {
    try {
      return await this.prisma.cliente.create({
        data: {
          emisorId,
          tipoDoc: input.tipoDoc,
          numeroDoc: input.numeroDoc,
          razonSocial: input.razonSocial,
          condicionIva: input.condicionIva,
          email: input.email,
        },
      });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  listar(emisorId: string) {
    return this.prisma.cliente.findMany({
      where: { emisorId },
      orderBy: { razonSocial: 'asc' },
    });
  }

  async obtener(emisorId: string, id: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, emisorId },
    });
    if (!cliente) throw new NotFoundException('Cliente inexistente.');
    return cliente;
  }

  async actualizar(emisorId: string, id: string, input: ActualizarCliente) {
    await this.obtener(emisorId, id); // valida existencia + pertenencia al emisor
    try {
      return await this.prisma.cliente.update({
        where: { id },
        data: {
          tipoDoc: input.tipoDoc,
          numeroDoc: input.numeroDoc,
          razonSocial: input.razonSocial,
          condicionIva: input.condicionIva,
          email: input.email,
        },
      });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async eliminar(emisorId: string, id: string) {
    await this.obtener(emisorId, id);
    await this.prisma.cliente.delete({ where: { id } });
    return { ok: true };
  }

  /** Traduce el unique constraint (emisor, tipoDoc, numeroDoc) a un 409 claro. */
  private mapError(e: unknown): unknown {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException(
        'Ya existe un cliente con ese documento para este emisor.',
      );
    }
    return e;
  }
}
