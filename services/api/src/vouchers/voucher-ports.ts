import type { FactoryProvider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WsfeService } from "../arca/wsfe/wsfe.service";
import type { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import type { IssuerOnboardingService } from "../issuer-arca/issuer-onboarding.service";
import type { ApiClientService } from "../service-auth/api-client.service";
import type { WebhookService } from "../webhooks/webhook.service";
import type { PushNotificationService } from "../notifications/push-notification.service";

export type WsfeGateway = Pick<
  WsfeService,
  "getLastAuthorized" | "requestCae" | "queryVoucher" | "queryVoucherDetail"
>;
export type IssuerAuthenticator = Pick<IssuerAuthService, "buildAuth">;
export type OnboardingTracker = Pick<IssuerOnboardingService, "track">;
export type IssuerGrants = Pick<ApiClientService, "assertIssuerGranted">;
export type WebhookDispatcher = Pick<WebhookService, "dispatch">;
export type IssuerOwnerNotifier = Pick<PushNotificationService, "notifyIssuerOwner">;

export interface VoucherRetryPolicy {
  maxRetries: number;
  retryBaseMs: number;
}

export const VOUCHER_RETRY_POLICY = Symbol("VoucherRetryPolicy");

const DEFAULT_MAX_RETRIES = 8;
const DEFAULT_RETRY_BASE_MS = 60_000;

export const voucherRetryPolicyProvider: FactoryProvider<VoucherRetryPolicy> = {
  provide: VOUCHER_RETRY_POLICY,
  inject: [ConfigService],
  useFactory: (config: ConfigService): VoucherRetryPolicy => ({
    maxRetries: config.get<number>("VOUCHER_MAX_RETRIES", DEFAULT_MAX_RETRIES),
    retryBaseMs: config.get<number>("VOUCHER_RETRY_BASE_MS", DEFAULT_RETRY_BASE_MS),
  }),
};
