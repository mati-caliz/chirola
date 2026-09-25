import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ArcaParamType, localArcaParams, type ArcaParam, type ArcaParamTypeName } from "@chirola/shared";
import type { ArcaIssuer } from "../arca/arca-environment";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { WsfeService } from "../arca/wsfe/wsfe.service";
import type { AuthContext } from "../arca/wsfe/wsfe.types";
import { MS_PER_DAY } from "../common/time";

const DEFAULT_CACHE_TTL_DAYS = 7;

const storedParamsSchema = z.array(z.object({ id: z.number(), description: z.string() }));

type ParamFetcher = (auth: AuthContext) => Promise<ArcaParam[]>;

function toStoredEntries(entries: ArcaParam[]): Prisma.InputJsonArray {
  return entries.map(({ id, description }) => ({ id, description }));
}

@Injectable()
export class ArcaParamCacheService {
  private readonly logger = new Logger(ArcaParamCacheService.name);
  private readonly cacheTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly issuerAuth: IssuerAuthService,
    private readonly wsfe: WsfeService,
    config: ConfigService,
  ) {
    this.cacheTtlMs = config.get<number>("ARCA_PARAM_CACHE_TTL_DAYS", DEFAULT_CACHE_TTL_DAYS) * MS_PER_DAY;
  }

  private fetcherFor(paramType: ArcaParamTypeName): ParamFetcher {
    const fetchers: Record<ArcaParamTypeName, ParamFetcher> = {
      [ArcaParamType.VOUCHER_TYPES]: (auth) => this.wsfe.getVoucherTypes(auth),
      [ArcaParamType.DOCUMENT_TYPES]: (auth) => this.wsfe.getDocumentTypes(auth),
      [ArcaParamType.IVA_RATES]: (auth) => this.wsfe.getIvaRates(auth),
      [ArcaParamType.TRIBUTE_TYPES]: (auth) => this.wsfe.getTributeTypes(auth),
      [ArcaParamType.OPTIONAL_TYPES]: (auth) => this.wsfe.getOptionalTypes(auth),
      [ArcaParamType.RECIPIENT_IVA_CONDITIONS]: (auth) => this.wsfe.getRecipientIvaConditions(auth),
    };
    return fetchers[paramType];
  }

  async get(issuer: ArcaIssuer, paramType: ArcaParamTypeName): Promise<ArcaParam[]> {
    const cached = await this.prisma.arcaParamCache.findUnique({
      where: { issuerId_paramType: { issuerId: issuer.id, paramType } },
    });
    const stored = cached === null ? null : storedParamsSchema.safeParse(cached.entries);
    const isFresh = cached !== null && Date.now() - cached.fetchedAt.getTime() < this.cacheTtlMs;

    if (stored?.success === true && isFresh) {
      return stored.data;
    }

    try {
      const auth = await this.issuerAuth.buildAuth(issuer);
      const entries = await this.fetcherFor(paramType)(auth);
      const storedEntries = toStoredEntries(entries);
      await this.prisma.arcaParamCache.upsert({
        where: { issuerId_paramType: { issuerId: issuer.id, paramType } },
        create: { issuerId: issuer.id, paramType, entries: storedEntries, fetchedAt: new Date() },
        update: { entries: storedEntries, fetchedAt: new Date() },
      });
      return entries;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (stored?.success === true) {
        this.logger.warn(
          `No se pudo refrescar ${paramType} desde ARCA (${reason}), se usa la caché vencida.`,
        );
        return stored.data;
      }
      this.logger.warn(
        `No se pudo obtener ${paramType} desde ARCA (${reason}), se usan los valores locales.`,
      );
      return localArcaParams[paramType];
    }
  }
}
