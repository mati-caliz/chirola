import { Injectable, NotFoundException, ForbiddenException, ConflictException } from "@nestjs/common";
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

const SERVICE_USER_DOMAIN = "service.chirola.internal";
const SERVICE_USER_UNUSABLE_HASH = "service-account-no-login";
const UNIQUE_CONSTRAINT_ERROR = "P2002";

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
  constructor(private readonly prisma: PrismaService) {}

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

  async getWithCertificate(id: string): Promise<IssuerDetail> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id },
      include: { certificate: { select: CERTIFICATE_DETAIL_SELECT } },
    });
    if (!issuer) throw new NotFoundException("Emisor inexistente.");
    const { certificate, ...rest } = issuer;
    return {
      ...rest,
      certificateValidUntil: hasText(certificate?.certPem) ? certificate.validUntil : null,
      onboarding: describeIssuerOnboardingStatus(issuer.onboardingStatus),
      certificate: certificate === null ? null : describeCertificate(certificate),
    };
  }

  async updateRepresentative(id: string, input: Representative): Promise<Issuer> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id },
      include: { certificate: { select: { certPem: true, holderCuit: true } } },
    });
    if (!issuer) throw new NotFoundException("Emisor inexistente.");

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
      where: { id },
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

  async updatePaymentAccount(id: string, input: PaymentAccount): Promise<Issuer> {
    return await this.prisma.issuer.update({
      where: { id },
      data: { cbu: input.cbu, paymentAlias: input.paymentAlias ?? null },
    });
  }

  async updateCommercialAddress(id: string, input: CommercialAddress): Promise<Issuer> {
    return await this.prisma.issuer.update({
      where: { id },
      data: { commercialAddress: input.commercialAddress },
    });
  }

  async list(userId: string): Promise<IssuerWithCertificateSummary[]> {
    return await this.prisma.issuer.findMany({
      where: { userId },
      include: CERTIFICATE_SUMMARY_INCLUDE,
    });
  }

  async getFromUser(id: string, userId: string): Promise<Issuer> {
    const issuer = await this.prisma.issuer.findUnique({ where: { id } });
    if (!issuer) throw new NotFoundException("Emisor inexistente.");
    if (issuer.userId !== userId) {
      throw new ForbiddenException("El emisor no pertenece al usuario.");
    }
    return issuer;
  }

  async getById(id: string): Promise<Issuer> {
    const issuer = await this.prisma.issuer.findUnique({ where: { id } });
    if (!issuer) throw new NotFoundException("Emisor inexistente.");
    return issuer;
  }
}
