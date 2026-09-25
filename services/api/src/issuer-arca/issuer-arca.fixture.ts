import type { ArcaIssuer } from "../arca/arca-environment";
import type { AuthContext } from "../arca/wsfe/wsfe.types";
import type { IssuerAuthService } from "./issuer-auth.service";
import type { IssuerOnboardingService } from "./issuer-onboarding.service";

export function fakeIssuerAuth(requestedServices: string[] = []): IssuerAuthService {
  return {
    buildAuth: async (issuer: ArcaIssuer, service = "wsfe"): Promise<AuthContext> => {
      requestedServices.push(service);
      return {
        issuerId: issuer.id,
        cuit: issuer.cuit,
        token: "token",
        sign: "sign",
        environment: issuer.environment,
      };
    },
  } as unknown as IssuerAuthService;
}

export function fakeIssuerOnboarding(): IssuerOnboardingService {
  return {
    track: <T>(_issuerId: string, _confirmation: string, operation: () => Promise<T>): Promise<T> =>
      operation(),
  } as unknown as IssuerOnboardingService;
}
