import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { UpdateClient, CreateClient } from "@chirola/shared";
import { Prisma, type Client } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { optionalField } from "../common/optional-field";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(issuerId: string, input: CreateClient): Promise<Client> {
    try {
      return await this.prisma.client.create({
        data: {
          issuerId,
          docType: input.docType,
          docNumber: input.docNumber,
          ...optionalField("legalName", input.legalName),
          ...optionalField("ivaCondition", input.ivaCondition),
          ...optionalField("email", input.email),
        },
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  list(issuerId: string): Promise<Client[]> {
    return this.prisma.client.findMany({
      where: { issuerId },
      orderBy: { legalName: "asc" },
    });
  }

  async get(issuerId: string, id: string): Promise<Client> {
    const client = await this.prisma.client.findFirst({
      where: { id, issuerId },
    });
    if (!client) throw new NotFoundException("Cliente inexistente.");
    return client;
  }

  async update(issuerId: string, id: string, input: UpdateClient): Promise<Client> {
    await this.get(issuerId, id);
    try {
      return await this.prisma.client.update({
        where: { id },
        data: {
          ...optionalField("docType", input.docType),
          ...optionalField("docNumber", input.docNumber),
          ...optionalField("legalName", input.legalName),
          ...optionalField("ivaCondition", input.ivaCondition),
          ...optionalField("email", input.email),
        },
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async delete(issuerId: string, id: string): Promise<{ ok: boolean }> {
    await this.get(issuerId, id);
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }

  private mapError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
      return new ConflictException("Ya existe un cliente con ese documento para este emisor.");
    }
    return error;
  }
}
