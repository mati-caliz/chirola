import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CertsService } from "../certs/certs.service";
import { WsaaService } from "../arca/wsaa/wsaa.service";
import type { ArcaService } from "../arca/wsaa/wsaa.types";
import type { ArcaIssuer } from "../arca/arca-environment";
import type { AuthContext } from "../arca/wsfe/wsfe.types";
import {
  assertCertificateBelongsToIssuer,
  expectedCertificateHolderCuit,
} from "./issuer-certificate-invariant";

const DEFAULT_ARCA_SERVICE: ArcaService = "wsfe";

@Injectable()
export class IssuerAuthService {
  private readonly logger = new Logger(IssuerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
  ) {}

  async buildAuth(issuer: ArcaIssuer, service: ArcaService = DEFAULT_ARCA_SERVICE): Promise<AuthContext> {
    const credentials = await this.certs.getCredentials(issuer.id);
    const holderCuit = this.resolveHolderCuit(issuer, credentials.holderCuit);
    const accessTicket = await this.wsaa.getAccessTicket({
      issuerId: issuer.id,
      holderCuit,
      environment: issuer.environment,
      credentials,
      service,
    });
    return {
      issuerId: issuer.id,
      cuit: issuer.cuit,
      token: accessTicket.token,
      sign: accessTicket.sign,
      environment: issuer.environment,
    };
  }

  async buildAuthForIssuerId(
    issuerId: string,
    service: ArcaService = DEFAULT_ARCA_SERVICE,
  ): Promise<AuthContext> {
    const issuer = await this.prisma.issuer.findUniqueOrThrow({
      where: { id: issuerId },
      select: {
        id: true,
        cuit: true,
        environment: true,
        representativeCuit: true,
      },
    });
    return this.buildAuth(issuer, service);
  }

  private resolveHolderCuit(issuer: ArcaIssuer, holderCuit: string | null): string {
    if (holderCuit) {
      assertCertificateBelongsToIssuer(issuer, holderCuit);
      return holderCuit;
    }
    this.logger.warn(
      `El certificado del emisor ${issuer.id} no declara el CUIT de su titular: ` +
        `no se puede verificar que corresponda al CUIT ${issuer.cuit}.`,
    );
    return expectedCertificateHolderCuit(issuer);
  }
}
