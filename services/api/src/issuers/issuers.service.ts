import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { CreateIssuer } from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IssuersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateIssuer) {
    return this.prisma.issuer.create({
      data: {
        userId,
        cuit: input.cuit,
        legalName: input.legalName,
        ivaCondition: input.ivaCondition,
        environment: input.environment,
      },
    });
  }

  async list(userId: string) {
    return this.prisma.issuer.findMany({
      where: { userId },
      include: { certificate: { select: { alias: true, validUntil: true } } },
    });
  }

  async getFromUser(id: string, userId: string) {
    const issuer = await this.prisma.issuer.findUnique({ where: { id } });
    if (!issuer) throw new NotFoundException('Emisor inexistente.');
    if (issuer.userId !== userId) {
      throw new ForbiddenException('El emisor no pertenece al usuario.');
    }
    return issuer;
  }
}
