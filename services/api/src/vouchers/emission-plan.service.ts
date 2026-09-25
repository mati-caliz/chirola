import { Inject, Injectable } from "@nestjs/common";
import {
  IssuerOnboardingStatus,
  type EmissionPlan,
  type EmissionPlanVerification,
  type IssueVoucher,
} from "@chirola/shared";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { ArcaConfirmation, IssuerOnboardingService } from "../issuer-arca/issuer-onboarding.service";
import { WsfeService } from "../arca/wsfe/wsfe.service";
import { calculateAmounts } from "../arca/wsfe/iva-calculator";
import type { IssuerAuthenticator, OnboardingTracker, WsfeGateway } from "./voucher-ports";
import type { EmissionIssuer } from "./voucher-emission.types";
import { VOUCHER_TABLES, type EmissionPlanTables } from "./voucher-tables";

const DRY_RUN_VERIFICATION_NOTE =
  "El dry-run confirma que el certificado y la autorización de ARCA funcionan, no que el " +
  "contribuyente esté habilitado para facturar: ARCA valida más cosas al autorizar un " +
  "comprobante que al consultar el último número.";

@Injectable()
export class EmissionPlanService {
  constructor(
    @Inject(VOUCHER_TABLES) private readonly tables: EmissionPlanTables,
    @Inject(IssuerAuthService) private readonly issuerAuth: IssuerAuthenticator,
    @Inject(IssuerOnboardingService) private readonly onboarding: OnboardingTracker,
    @Inject(WsfeService) private readonly wsfe: WsfeGateway,
  ) {}

  async computeEmissionPlan(issuer: EmissionIssuer, input: IssueVoucher): Promise<EmissionPlan> {
    const last = await this.onboarding.track(issuer.id, ArcaConfirmation.READ_ONLY, async () => {
      const auth = await this.issuerAuth.buildAuth(issuer);
      return await this.wsfe.getLastAuthorized(auth, input.salesPoint, input.voucherType);
    });
    const amounts = calculateAmounts(input.voucherType, input.items, input.tributes);
    return {
      verification: await this.describeVerification(issuer.id),
      salesPoint: input.salesPoint,
      voucherType: input.voucherType,
      number: last + 1,
      netAmount: amounts.netAmount,
      ivaAmount: amounts.ivaAmount,
      totalAmount: amounts.totalAmount,
      rates: amounts.rates,
    };
  }

  private async describeVerification(issuerId: string): Promise<EmissionPlanVerification> {
    const issuer = await this.tables.issuer.findUniqueOrThrow({
      where: { id: issuerId },
      select: { onboardingStatus: true },
    });
    return {
      onboardingStatus: issuer.onboardingStatus,
      confirmsIssuing: issuer.onboardingStatus === IssuerOnboardingStatus.ISSUING_CONFIRMED,
      note: DRY_RUN_VERIFICATION_NOTE,
    };
  }
}
