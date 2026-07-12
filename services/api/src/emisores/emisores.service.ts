import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { CrearEmisor } from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmisoresService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(userId: string, input: CrearEmisor) {
    return this.prisma.emisor.create({
      data: {
        userId,
        cuit: input.cuit,
        razonSocial: input.razonSocial,
        condicionIva: input.condicionIva,
        ambiente: input.ambiente,
      },
    });
  }

  async listar(userId: string) {
    return this.prisma.emisor.findMany({
      where: { userId },
      include: { certificado: { select: { alias: true, validoHasta: true } } },
    });
  }

  /** Devuelve el emisor sólo si pertenece al usuario; si no, 404/403. */
  async obtenerDeUsuario(id: string, userId: string) {
    const emisor = await this.prisma.emisor.findUnique({ where: { id } });
    if (!emisor) throw new NotFoundException('Emisor inexistente.');
    if (emisor.userId !== userId) {
      throw new ForbiddenException('El emisor no pertenece al usuario.');
    }
    return emisor;
  }
}
