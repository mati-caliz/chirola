import { Injectable } from "@nestjs/common";
import { IssuerOnboardingStatus, type IssuerOnboardingStatusName } from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ArcaDelegationError, ArcaRejectionError, ARCA_TOKEN_RELATION_CODE } from "../arca/wsfe/arca-errors";
import { tokenRelationExplanation } from "./arca-onboarding-diagnosis";

export const ArcaConfirmation = {
  READ_ONLY: "READ_ONLY",
  ISSUE: "ISSUE",
} as const;

export type ArcaConfirmationKind = (typeof ArcaConfirmation)[keyof typeof ArcaConfirmation];

const CONFIRMED_STATUS: Record<ArcaConfirmationKind, IssuerOnboardingStatusName> = {
  READ_ONLY: IssuerOnboardingStatus.DELEGATION_CONFIRMED,
  ISSUE: IssuerOnboardingStatus.ISSUING_CONFIRMED,
};

@Injectable()
export class IssuerOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async track<T>(
    issuerId: string,
    confirmation: ArcaConfirmationKind,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      const result = await operation();
      await this.confirm(issuerId, confirmation);
      return result;
    } catch (error) {
      throw await this.diagnose(issuerId, error);
    }
  }

  private async confirm(issuerId: string, confirmation: ArcaConfirmationKind): Promise<void> {
    const reached = CONFIRMED_STATUS[confirmation];
    const issuer = await this.prisma.issuer.findUniqueOrThrow({
      where: { id: issuerId },
      select: { onboardingStatus: true },
    });
    if (issuer.onboardingStatus === IssuerOnboardingStatus.ISSUING_CONFIRMED) {
      return;
    }
    if (issuer.onboardingStatus === reached) return;
    await this.prisma.issuer.update({
      where: { id: issuerId },
      data: { onboardingStatus: reached },
    });
  }

  private async diagnose(issuerId: string, error: unknown): Promise<unknown> {
    if (!(error instanceof ArcaRejectionError) || !error.hasCode(ARCA_TOKEN_RELATION_CODE)) {
      return error;
    }
    const issuer = await this.prisma.issuer.findUniqueOrThrow({
      where: { id: issuerId },
      select: { onboardingStatus: true },
    });
    const explanation = tokenRelationExplanation(issuer.onboardingStatus);
    await this.prisma.issuer.update({
      where: { id: issuerId },
      data: { onboardingStatus: this.statusAfterRejection(issuer.onboardingStatus) },
    });
    return new ArcaDelegationError(error.codes, explanation);
  }

  private statusAfterRejection(current: string): IssuerOnboardingStatusName {
    return current === IssuerOnboardingStatus.PENDING_CERTIFICATE ||
      current === IssuerOnboardingStatus.PENDING_DELEGATION
      ? IssuerOnboardingStatus.PENDING_DELEGATION
      : IssuerOnboardingStatus.BLOCKED_BY_ARCA;
  }
}
