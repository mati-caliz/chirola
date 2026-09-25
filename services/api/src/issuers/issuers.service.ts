import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Issuer } from "@prisma/client";
import {
  describeIssuerOnboardingStatus,
  hasText,
  normalizeCuit,
  type CommercialAddress,
  type CreateIssuer,
  type PaymentAccount,
  type Representative,
} from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ApiClientService } from "../service-auth/api-client.service";

const SERVICE_USER_DOMAIN = "service.chirola.internal";
const SERVICE_USER_UNUSABLE_HASH = "service-account-no-login";
const UNIQUE_CONSTRAINT_ERROR = "P2002";
const MISSING_ISSUER_MESSAGE = "Emisor inexistente.";
const FOREIGN_ISSUER_MESSAGE = "El emisor no pertenece al usuario.";

const CERTIFICATE_SUMMARY_INCLUDE = {
  certificate: { select: { alias: true, validUntil: true } },
} satisfies Prisma.IssuerInclude;

const CERTIFICATE_DETAIL_SELECT = {
  alias: true,
  validUntil: true,
  certPem: true,
  holderCuit: true,
} satisfies Prisma.CertificateSelect;

export const IssuerCertificateStatus = {
  READY: "ready",
  PENDING_CERTIFICATE: "pending_certificate",
} as const;

export type IssuerCertificateStatusName =
  (typeof IssuerCertificateStatus)[keyof typeof IssuerCertificateStatus];

export type IssuerWithCertificateSummary = Prisma.IssuerGetPayload<{
  include: typeof CERTIFICATE_SUMMARY_INCLUDE;
}>;

type StoredCertificateDetail = Prisma.CertificateGetPayload<{ select: typeof CERTIFICATE_DETAIL_SELECT }>;

export interface IssuerCertificateDetail {
  alias: string | null;
  validUntil: Date | null;
  holderCuit: string | null;
  status: IssuerCertificateStatusName;
}

export type IssuerOwner = { userId: string } | { apiClientId: string };

type IssuerGrants = Pick<ApiClientService, "assertIssuerGranted">;

interface OwnedIssuerWhere {
  id: string;
  userId?: string;
}

export type IssuerDetail = Issuer & {
  certificateValidUntil: Date | null;
  onboarding: string;
  certificate: IssuerCertificateDetail | null;
};

function describeCertificate(certificate: StoredCertificateDetail): IssuerCertificateDetail {
  return {
    alias: certificate.alias,
    validUntil: certificate.validUntil,
    holderCuit: certificate.holderCuit,
    status: hasText(certificate.certPem)
      ? IssuerCertificateStatus.READY
      : IssuerCertificateStatus.PENDING_CERTIFICATE,
  };
}

@Injectable()
export class IssuersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ApiClientService) private readonly grants: IssuerGrants,
  ) {}

  private serviceUserEmail(apiClientId: string): string {
    return `${apiClientId}@${SERVICE_USER_DOMAIN}`;
  }

  private async ensureServiceUser(tx: Prisma.TransactionClient, apiClientId: string): Promise<string> {
    const email = this.serviceUserEmail(apiClientId);
    const user = await tx.user.upsert({
      where: { email },
      create: { email, password: SERVICE_USER_UNUSABLE_HASH },
      update: {},
      select: { id: true },
    });
    return user.id;
  }

  async createForApiClient(apiClientId: string, input: CreateIssuer): Promise<Issuer> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const userId = await this.ensureServiceUser(tx, apiClientId);
        const issuer = await tx.issuer.create({
          data: {
            userId,
            cuit: input.cuit,
            legalName: input.legalName,
            commercialAddress: input.commercialAddress ?? null,
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_ERROR) {
        throw new ConflictException("Ya existe un emisor con ese CUIT para este entorno.");
      }
      throw error;
    }
  }

  async listForApiClient(apiClientId: string): Promise<IssuerWithCertificateSummary[]> {
    const grants = await this.prisma.apiClientIssuer.findMany({
      where: { apiClientId },
      select: { issuerId: true },
    });
    return await this.prisma.issuer.findMany({
      where: { id: { in: grants.map((grant) => grant.issuerId) } },
      include: CERTIFICATE_SUMMARY_INCLUDE,
    });
  }

  async getWithCertificate(owner: IssuerOwner, id: string): Promise<IssuerDetail> {
    const where = await this.ownedIssuerWhere(owner, id);
    const issuer = await this.prisma.issuer.findFirst({
      where,
      include: { certificate: { select: CERTIFICATE_DETAIL_SELECT } },
    });
    if (!issuer) return await this.rejectUnowned(owner, id);
    const { certificate, ...rest } = issuer;
    return {
      ...rest,
      certificateValidUntil: hasText(certificate?.certPem) ? certificate.validUntil : null,
      onboarding: describeIssuerOnboardingStatus(issuer.onboardingStatus),
      certificate: certificate === null ? null : describeCertificate(certificate),
    };
  }

  async updateRepresentative(owner: IssuerOwner, id: string, input: Representative): Promise<Issuer> {
    const where = await this.ownedIssuerWhere(owner, id);
    const issuer = await this.prisma.issuer.findFirst({
      where,
      include: { certificate: { select: { certPem: true, holderCuit: true } } },
    });
    if (!issuer) return await this.rejectUnowned(owner, id);

    const loadedHolderCuit = hasText(issuer.certificate?.certPem) ? issuer.certificate.holderCuit : null;
    const expectedHolderCuit = normalizeCuit(input.representativeCuit ?? issuer.cuit);
    if (hasText(loadedHolderCuit) && loadedHolderCuit !== expectedHolderCuit) {
      throw new ConflictException(
        `El certificado cargado pertenece al CUIT ${loadedHolderCuit} y el cambio lo ` +
          `dejaría sin corresponder al titular ${expectedHolderCuit}. Primero hay que ` +
          "cargar el certificado del nuevo titular.",
      );
    }

    return await this.prisma.issuer.update({
      where,
      data: { representativeCuit: input.representativeCuit },
    });
  }

  async create(userId: string, input: CreateIssuer): Promise<Issuer> {
    return await this.prisma.issuer.create({
      data: {
        userId,
        cuit: input.cuit,
        legalName: input.legalName,
        commercialAddress: input.commercialAddress ?? null,
        ivaCondition: input.ivaCondition,
        environment: input.environment,
      },
    });
  }

  async updatePaymentAccount(owner: IssuerOwner, id: string, input: PaymentAccount): Promise<Issuer> {
    const where = await this.requireOwnedIssuerWhere(owner, id);
    return await this.prisma.issuer.update({
      where,
      data: { cbu: input.cbu, paymentAlias: input.paymentAlias ?? null },
    });
  }

  async updateCommercialAddress(owner: IssuerOwner, id: string, input: CommercialAddress): Promise<Issuer> {
    const where = await this.requireOwnedIssuerWhere(owner, id);
    return await this.prisma.issuer.update({
      where,
      data: { commercialAddress: input.commercialAddress },
    });
  }

  async list(userId: string): Promise<IssuerWithCertificateSummary[]> {
    return await this.prisma.issuer.findMany({
      where: { userId },
      include: CERTIFICATE_SUMMARY_INCLUDE,
    });
  }

  getFromUser(id: string, userId: string): Promise<Issuer> {
    return this.getOwned({ userId }, id);
  }

  async getOwned(owner: IssuerOwner, id: string): Promise<Issuer> {
    const where = await this.ownedIssuerWhere(owner, id);
    const issuer = await this.prisma.issuer.findFirst({ where });
    if (!issuer) return await this.rejectUnowned(owner, id);
    return issuer;
  }

  private async requireOwnedIssuerWhere(owner: IssuerOwner, id: string): Promise<OwnedIssuerWhere> {
    const where = await this.ownedIssuerWhere(owner, id);
    const issuer = await this.prisma.issuer.findFirst({ where, select: { id: true } });
    if (!issuer) return await this.rejectUnowned(owner, id);
    return where;
  }

  private async ownedIssuerWhere(owner: IssuerOwner, id: string): Promise<OwnedIssuerWhere> {
    if ("apiClientId" in owner) {
      await this.grants.assertIssuerGranted(owner.apiClientId, id);
      return { id };
    }
    return { id, userId: owner.userId };
  }

  private async rejectUnowned(owner: IssuerOwner, id: string): Promise<never> {
    if ("userId" in owner && (await this.prisma.issuer.count({ where: { id } })) > 0) {
      throw new ForbiddenException(FOREIGN_ISSUER_MESSAGE);
    }
    throw new NotFoundException(MISSING_ISSUER_MESSAGE);
  }
}
