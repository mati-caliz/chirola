import { ConfigService } from "@nestjs/config";
import { CertMonitorService } from "./cert-monitor.service";
import { WebhookService } from "../webhooks/webhook.service";
import { WebhookEvent } from "../webhooks/webhook-events";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationService } from "../notifications/push-notification.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { MS_PER_DAY } from "../common/time";

const WARNING_DAYS = 30;
const DAYS_TO_EXPIRY_OFF_THRESHOLD = 10;
const DAYS_TO_EXPIRY_ON_THRESHOLD = 7;

interface ExpiringCertificate {
  issuerId: string;
  validUntil: Date;
}

interface MonitorDoubles {
  certificates: ExpiringCertificate[];
  dispatch: jest.Mock;
  notifyIssuerOwner: jest.Mock;
}

function config(warningDays: number) {
  return {
    get: (key: string, defaultValue?: number) =>
      key === "CERT_EXPIRY_WARNING_DAYS" ? warningDays : defaultValue,
  };
}

function certificateExpiringIn(days: number): ExpiringCertificate {
  return { issuerId: "issuer-1", validUntil: new Date(Date.now() + days * MS_PER_DAY) };
}

function resolvedMock(): jest.Mock {
  return jest.fn(() => Promise.resolve());
}

function createMonitor({
  certificates,
  dispatch,
  notifyIssuerOwner,
}: MonitorDoubles): Promise<CertMonitorService> {
  const prisma = { certificate: { findMany: jest.fn(() => Promise.resolve(certificates)) } };
  return instantiateWithDoubles(CertMonitorService, [
    { token: PrismaService, value: prisma },
    { token: WebhookService, value: { dispatch } },
    { token: PushNotificationService, value: { notifyIssuerOwner } },
    { token: ConfigService, value: config(WARNING_DAYS) },
  ]);
}

describe("CertMonitorService", () => {
  it("dispara certificate.expiring para certificados próximos a vencer", async () => {
    const dispatch = resolvedMock();
    const service = await createMonitor({
      certificates: [certificateExpiringIn(DAYS_TO_EXPIRY_OFF_THRESHOLD)],
      dispatch,
      notifyIssuerOwner: resolvedMock(),
    });

    await service.checkExpiringCertificates();

    expect(dispatch).toHaveBeenCalledWith(
      "issuer-1",
      WebhookEvent.CERTIFICATE_EXPIRING,
      expect.objectContaining({ issuerId: "issuer-1", daysToExpiry: DAYS_TO_EXPIRY_OFF_THRESHOLD }),
    );
  });

  it("no dispara si no hay certificados por vencer", async () => {
    const dispatch = jest.fn();
    const service = await createMonitor({ certificates: [], dispatch, notifyIssuerOwner: resolvedMock() });

    await service.checkExpiringCertificates();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("avisa por push sólo en los días de umbral, no todos los días", async () => {
    const pushOnThreshold = resolvedMock();
    const pushOffThreshold = resolvedMock();

    const monitorOnThreshold = await createMonitor({
      certificates: [certificateExpiringIn(DAYS_TO_EXPIRY_ON_THRESHOLD)],
      dispatch: resolvedMock(),
      notifyIssuerOwner: pushOnThreshold,
    });
    const monitorOffThreshold = await createMonitor({
      certificates: [certificateExpiringIn(DAYS_TO_EXPIRY_OFF_THRESHOLD)],
      dispatch: resolvedMock(),
      notifyIssuerOwner: pushOffThreshold,
    });
    await monitorOnThreshold.checkExpiringCertificates();
    await monitorOffThreshold.checkExpiringCertificates();

    expect(pushOnThreshold).toHaveBeenCalledTimes(1);
    expect(pushOffThreshold).not.toHaveBeenCalled();
  });
});
