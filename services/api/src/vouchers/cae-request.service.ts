import { Inject, Injectable, Logger } from "@nestjs/common";
import { defaultRecipientIvaCondition, type IssueVoucher } from "@chirola/shared";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { ArcaConfirmation, IssuerOnboardingService } from "../issuer-arca/issuer-onboarding.service";
import { WsfeService } from "../arca/wsfe/wsfe.service";
import type {
  AuthContext,
  AuthorizedVoucherDetail,
  CaeRequest,
  CaeResult,
  VoucherAmounts,
} from "../arca/wsfe/wsfe.types";
import { ArcaRejectionError, ARCA_DUPLICATE_NUMBER_CODE } from "../arca/wsfe/arca-errors";
import { calculateAmounts } from "../arca/wsfe/iva-calculator";
import { buildCreditInvoiceOptionals } from "../arca/wsfe/credit-invoice-optionals";
import { CaeAttemptError } from "./cae-attempt.error";
import type { IssuerAuthenticator, OnboardingTracker, WsfeGateway } from "./voucher-ports";
import type { EmissionIssuer, EmissionOutcome } from "./voucher-emission.types";
import type { PendingVoucherRow } from "./voucher-tables";
import { optionalField } from "../common/optional-field";

interface CaeWithNumber {
  result: CaeResult;
  number: number;
}

type CaeRequestBuilder = (voucherNumber: number) => CaeRequest;

const AMOUNT_TOLERANCE = 0.01;
const PROBE_VOUCHER_NUMBER = 0;
const NON_DIGITS = /\D/g;

function onlyDigits(value: string): string {
  return value.replace(NON_DIGITS, "");
}

function matchesPendingVoucher(
  authorized: AuthorizedVoucherDetail,
  input: IssueVoucher,
  amounts: VoucherAmounts,
): boolean {
  const sameTotal = Math.abs(authorized.totalAmount - amounts.totalAmount) < AMOUNT_TOLERANCE;
  const sameRecipient =
    authorized.recipientDocType === input.recipient.docType &&
    onlyDigits(authorized.recipientDocNumber) === onlyDigits(input.recipient.docNumber);
  return sameTotal && sameRecipient;
}

function caeRequestBuilder(
  issuer: EmissionIssuer,
  input: IssueVoucher,
  amounts: VoucherAmounts,
  date: Date,
): CaeRequestBuilder {
  const ivaConditionId = input.recipient.ivaConditionId ?? defaultRecipientIvaCondition(input.voucherType);
  const optionals = buildCreditInvoiceOptionals(input.voucherType, issuer, input.transmissionType);
  return (voucherNumber: number): CaeRequest => ({
    salesPoint: input.salesPoint,
    voucherType: input.voucherType,
    concept: input.concept,
    number: voucherNumber,
    date,
    recipient: {
      docType: input.recipient.docType,
      docNumber: input.recipient.docNumber,
      ivaConditionId,
    },
    amounts,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    ...optionalField("associatedVouchers", input.associatedVouchers),
    ...optionalField("servicePeriod", input.servicePeriod),
    ...optionalField("paymentDueDate", input.paymentDueDate),
    optionals,
  });
}

@Injectable()
export class CaeRequestService {
  private readonly logger = new Logger(CaeRequestService.name);

  constructor(
    @Inject(IssuerAuthService) private readonly issuerAuth: IssuerAuthenticator,
    @Inject(IssuerOnboardingService) private readonly onboarding: OnboardingTracker,
    @Inject(WsfeService) private readonly wsfe: WsfeGateway,
  ) {}

  attemptCae(issuer: EmissionIssuer, input: IssueVoucher): Promise<EmissionOutcome> {
    return this.onboarding.track(issuer.id, ArcaConfirmation.ISSUE, () => this.requestCae(issuer, input));
  }

  async recoverAlreadyAuthorized(
    issuer: EmissionIssuer,
    input: IssueVoucher,
    pending: PendingVoucherRow,
  ): Promise<EmissionOutcome | null> {
    if (pending.attemptedNumber === null || pending.attemptedSalesPoint === null) {
      return null;
    }

    const auth = await this.issuerAuth.buildAuth(issuer);
    const authorized = await this.wsfe.queryVoucherDetail(
      auth,
      pending.attemptedSalesPoint,
      input.voucherType,
      pending.attemptedNumber,
    );
    if (!authorized) {
      return null;
    }

    const amounts = calculateAmounts(input.voucherType, input.items, input.tributes);
    if (!matchesPendingVoucher(authorized, input, amounts)) {
      this.logger.warn(
        `El comprobante ${input.voucherType}-${pending.attemptedSalesPoint}-${pending.attemptedNumber} ya existe en ARCA pero no coincide con el encolado ${pending.id}; se emite uno nuevo.`,
      );
      return null;
    }

    this.logger.warn(
      `Comprobante encolado ${pending.id} ya tenía CAE en ARCA (${authorized.cae.cae}); se adopta en vez de re-emitir.`,
    );
    return {
      cae: authorized.cae,
      number: authorized.number,
      amounts,
      date: authorized.date,
      recovered: true,
    };
  }

  private async requestCae(issuer: EmissionIssuer, input: IssueVoucher): Promise<EmissionOutcome> {
    const auth = await this.issuerAuth.buildAuth(issuer);

    const amounts = calculateAmounts(input.voucherType, input.items, input.tributes);
    const date = new Date();
    const buildRequest = caeRequestBuilder(issuer, input, amounts, date);

    const { result: cae, number } = await this.requestCaeWithRecovery(auth, buildRequest);
    return { cae, number, amounts, date, recovered: false };
  }

  private async requestCaeWithRecovery(
    auth: AuthContext,
    buildRequest: CaeRequestBuilder,
  ): Promise<CaeWithNumber> {
    const { salesPoint } = buildRequest(PROBE_VOUCHER_NUMBER);
    let attemptedNumber: number | null = null;
    try {
      return await this.requestCaeAttempt(auth, buildRequest, (candidate) => {
        attemptedNumber = candidate;
      });
    } catch (err) {
      if (err instanceof ArcaRejectionError) {
        throw err;
      }
      throw new CaeAttemptError(err, salesPoint, attemptedNumber);
    }
  }

  private async requestCaeAttempt(
    auth: AuthContext,
    buildRequest: CaeRequestBuilder,
    onNumberChosen: (number: number) => void,
  ): Promise<CaeWithNumber> {
    const { salesPoint, voucherType } = buildRequest(PROBE_VOUCHER_NUMBER);
    const last = await this.wsfe.getLastAuthorized(auth, salesPoint, voucherType);
    const number = last + 1;
    onNumberChosen(number);
    try {
      const result = await this.wsfe.requestCae(auth, buildRequest(number));
      return { result, number };
    } catch (err) {
      if (!(err instanceof ArcaRejectionError) || !err.hasCode(ARCA_DUPLICATE_NUMBER_CODE)) {
        throw err;
      }
      const existing = await this.wsfe.queryVoucher(auth, salesPoint, voucherType, number);
      if (existing) {
        this.logger.warn(`CAE recuperado tras duplicado ${voucherType}-${salesPoint}-${number}`);
        return { result: existing, number };
      }
      const freshNumber = (await this.wsfe.getLastAuthorized(auth, salesPoint, voucherType)) + 1;
      onNumberChosen(freshNumber);
      this.logger.warn(
        `Número duplicado ${voucherType}-${salesPoint}-${number}, reintentando con ${freshNumber}`,
      );
      const result = await this.wsfe.requestCae(auth, buildRequest(freshNumber));
      return { result, number: freshNumber };
    }
  }
}
