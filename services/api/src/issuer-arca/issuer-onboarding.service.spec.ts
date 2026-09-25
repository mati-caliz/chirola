import { IssuerOnboardingStatus } from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ArcaDelegationError, ArcaRejectionError, ARCA_TOKEN_RELATION_CODE } from "../arca/wsfe/arca-errors";
import { ArcaConfirmation, IssuerOnboardingService } from "./issuer-onboarding.service";

const ISSUER_ID = "issuer-1";

function build(onboardingStatus: string) {
  const issuer = { onboardingStatus };
  const prisma = {
    issuer: {
      findUniqueOrThrow: async () => issuer,
      update: async ({ data }: { data: { onboardingStatus: string } }) => {
        issuer.onboardingStatus = data.onboardingStatus;
        return issuer;
      },
    },
  } as unknown as PrismaService;
  return { service: new IssuerOnboardingService(prisma), issuer };
}

describe("IssuerOnboardingService", () => {
  it("confirma la delegación después de una consulta de sólo lectura", async () => {
    const { service, issuer } = build(IssuerOnboardingStatus.PENDING_DELEGATION);

    await service.track(ISSUER_ID, ArcaConfirmation.READ_ONLY, async () => 1);

    expect(issuer.onboardingStatus).toBe(IssuerOnboardingStatus.DELEGATION_CONFIRMED);
  });

  it("marca al emisor como facturando después de un cae", async () => {
    const { service, issuer } = build(IssuerOnboardingStatus.DELEGATION_CONFIRMED);

    await service.track(ISSUER_ID, ArcaConfirmation.ISSUE, async () => 1);

    expect(issuer.onboardingStatus).toBe(IssuerOnboardingStatus.ISSUING_CONFIRMED);
  });

  it("no retrocede el estado de un emisor que ya facturó", async () => {
    const { service, issuer } = build(IssuerOnboardingStatus.ISSUING_CONFIRMED);

    await service.track(ISSUER_ID, ArcaConfirmation.READ_ONLY, async () => 1);

    expect(issuer.onboardingStatus).toBe(IssuerOnboardingStatus.ISSUING_CONFIRMED);
  });

  it("pide hacer la delegación si ARCA nunca aceptó al emisor", async () => {
    const { service, issuer } = build(IssuerOnboardingStatus.PENDING_DELEGATION);

    const failure = service.track(ISSUER_ID, ArcaConfirmation.ISSUE, () =>
      Promise.reject(new ArcaRejectionError([ARCA_TOKEN_RELATION_CODE], ["sin relaciones"])),
    );

    await expect(failure).rejects.toBeInstanceOf(ArcaDelegationError);
    await expect(failure).rejects.toThrow("Administrador de Relaciones");
    expect(issuer.onboardingStatus).toBe(IssuerOnboardingStatus.PENDING_DELEGATION);
  });

  it("culpa a la situación fiscal si la delegación ya había funcionado", async () => {
    const { service, issuer } = build(IssuerOnboardingStatus.ISSUING_CONFIRMED);

    const failure = service.track(ISSUER_ID, ArcaConfirmation.ISSUE, () =>
      Promise.reject(new ArcaRejectionError([ARCA_TOKEN_RELATION_CODE], ["sin relaciones"])),
    );

    await expect(failure).rejects.toThrow("no está habilitado para facturar");
    expect(issuer.onboardingStatus).toBe(IssuerOnboardingStatus.BLOCKED_BY_ARCA);
  });

  it("deja intactos los demás rechazos de ARCA", async () => {
    const { service, issuer } = build(IssuerOnboardingStatus.ISSUING_CONFIRMED);
    const rejection = new ArcaRejectionError(["10016"], ["duplicado"]);

    await expect(
      service.track(ISSUER_ID, ArcaConfirmation.ISSUE, () => Promise.reject(rejection)),
    ).rejects.toBe(rejection);
    expect(issuer.onboardingStatus).toBe(IssuerOnboardingStatus.ISSUING_CONFIRMED);
  });
});
