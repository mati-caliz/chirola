import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UpdateClient, CreateClient } from '@chirola/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(issuerId: string, input: CreateClient) {
    try {
      return await this.prisma.client.create({
        data: {
          issuerId,
          docType: input.docType,
          docNumber: input.docNumber,
          legalName: input.legalName,
          ivaCondition: input.ivaCondition,
          email: input.email,
        },
      });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  list(issuerId: string) {
    return this.prisma.client.findMany({
      where: { issuerId },
      orderBy: { legalName: 'asc' },
    });
  }

  async get(issuerId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, issuerId },
    });
    if (!client) throw new NotFoundException('Cliente inexistente.');
    return client;
  }

  async update(issuerId: string, id: string, input: UpdateClient) {
    await this.get(issuerId, id);
    try {
      return await this.prisma.client.update({
        where: { id },
        data: {
          docType: input.docType,
          docNumber: input.docNumber,
          legalName: input.legalName,
          ivaCondition: input.ivaCondition,
          email: input.email,
        },
      });
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async delete(issuerId: string, id: string) {
    await this.get(issuerId, id);
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }

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
