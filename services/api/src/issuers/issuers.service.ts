import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateIssuer } from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';

const SERVICE_USER_DOMAIN = 'service.chirola.internal';
const SERVICE_USER_PASSWORD = 'service-account-no-login';
const UNIQUE_CONSTRAINT_ERROR = 'P2002';

@Injectable()
export class IssuersService {
  constructor(private readonly prisma: PrismaService) {}

  private serviceUserEmail(apiClientId: string): string {
    return `${apiClientId}@${SERVICE_USER_DOMAIN}`;
  }

  private async ensureServiceUser(
    tx: Prisma.TransactionClient,
    apiClientId: string,
  ): Promise<string> {
    const email = this.serviceUserEmail(apiClientId);
    const user = await tx.user.upsert({
      where: { email },
      create: { email, password: SERVICE_USER_PASSWORD },
      update: {},
      select: { id: true },
    });
    return user.id;
  }

  async createForApiClient(apiClientId: string, input: CreateIssuer) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const userId = await this.ensureServiceUser(tx, apiClientId);
        const issuer = await tx.issuer.create({
          data: {
            userId,
            cuit: input.cuit,
            legalName: input.legalName,
            ivaCondition: input.ivaCondition,
            environment: input.environment,
          },
        });
        await tx.apiClientIssuer.create({
          data: { apiClientId, issuerId: issuer.id },
        });
        return issuer;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_ERROR
      ) {
        throw new ConflictException(
          'Ya existe un emisor con ese CUIT para este entorno.',
        );
      }
      throw error;
    }
  }

  async listForApiClient(apiClientId: string) {
    const grants = await this.prisma.apiClientIssuer.findMany({
      where: { apiClientId },
      select: { issuerId: true },
    });
    return this.prisma.issuer.findMany({
      where: { id: { in: grants.map((grant) => grant.issuerId) } },
      include: { certificate: { select: { alias: true, validUntil: true } } },
    });
  }

  async getWithCertificate(id: string) {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id },
      include: {
        certificate: { select: { alias: true, validUntil: true, certPem: true } },
      },
    });
    if (!issuer) throw new NotFoundException('Emisor inexistente.');
    const { certificate, ...rest } = issuer;
    return {
      ...rest,
      certificate: certificate
        ? {
            alias: certificate.alias,
            validUntil: certificate.validUntil,
            status: certificate.certPem ? 'ready' : 'pending_certificate',
          }
        : null,
    };
  }

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

  async getById(id: string) {
    const issuer = await this.prisma.issuer.findUnique({ where: { id } });
    if (!issuer) throw new NotFoundException('Emisor inexistente.');
    return issuer;
  }
}
