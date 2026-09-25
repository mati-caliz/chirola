import { ConfigService } from "@nestjs/config";
import type { ArcaIssuer } from "../arca/arca-environment";
import { RecordedArcaCalls } from "../arca/arca-call-recorder.fixture";
import { WsaaService } from "../arca/wsaa/wsaa.service";
import type { ArcaService } from "../arca/wsaa/wsaa.types";
import type { AuthContext } from "../arca/wsfe/wsfe.types";
import { CertsService } from "../certs/certs.service";
import { FieldEncryptionService } from "../crypto/field-encryption.service";
import { prismaDouble } from "../prisma/prisma.fixture";
import { IssuerAuthService } from "./issuer-auth.service";
import { IssuerOnboardingService, type ArcaConfirmationKind } from "./issuer-onboarding.service";

const ENCRYPTION_KEY_BYTES = 32;
const UNUSED_ENCRYPTION_KEY = Buffer.alloc(ENCRYPTION_KEY_BYTES).toString("base64");
const DEFAULT_ARCA_SERVICE: ArcaService = "wsfe";

function unusedCertsService(): CertsService {
  const config = new ConfigService({ CERT_ENCRYPTION_KEY: UNUSED_ENCRYPTION_KEY });
  return new CertsService(prismaDouble({}), new FieldEncryptionService(config));
}

function unusedWsaaService(): WsaaService {
  return new WsaaService(new ConfigService(), prismaDouble({}), new RecordedArcaCalls());
}

class FakeIssuerAuthService extends IssuerAuthService {
  constructor(private readonly requestedServices: string[]) {
    super(prismaDouble({}), unusedCertsService(), unusedWsaaService());
  }

  override buildAuth(issuer: ArcaIssuer, service: ArcaService = DEFAULT_ARCA_SERVICE): Promise<AuthContext> {
    this.requestedServices.push(service);
    return Promise.resolve({
      issuerId: issuer.id,
      cuit: issuer.cuit,
      token: "token",
      sign: "sign",
      environment: issuer.environment,
    });
  }
}

class FakeIssuerOnboardingService extends IssuerOnboardingService {
  constructor() {
    super(prismaDouble({}));
  }

  override track<T>(
    _issuerId: string,
    _confirmation: ArcaConfirmationKind,
    operation: () => Promise<T>,
  ): Promise<T> {
    return operation();
  }
}

export function fakeIssuerAuth(requestedServices: string[] = []): IssuerAuthService {
  return new FakeIssuerAuthService(requestedServices);
}

export function fakeIssuerOnboarding(): IssuerOnboardingService {
  return new FakeIssuerOnboardingService();
}
