import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  ArcaParamType,
  localArcaParams,
  type ArcaParam,
  type ArcaParamTypeName,
} from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CertsService } from '../certs/certs.service';
import { WsaaService } from '../arca/wsaa/wsaa.service';
import { WsfeService } from '../arca/wsfe/wsfe.service';
import type { AuthContext } from '../arca/wsfe/wsfe.types';

const DEFAULT_CACHE_TTL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const storedParamsSchema = z.array(
  z.object({ id: z.number(), description: z.string() }),
);

type ParamFetcher = (auth: AuthContext) => Promise<ArcaParam[]>;

@Injectable()
export class ArcaParamCacheService {
  private readonly logger = new Logger(ArcaParamCacheService.name);
  private readonly cacheTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
    private readonly wsfe: WsfeService,
    config: ConfigService,
  ) {
    this.cacheTtlMs =
      config.get<number>('ARCA_PARAM_CACHE_TTL_DAYS', DEFAULT_CACHE_TTL_DAYS) *
      MS_PER_DAY;
  }

  private fetcherFor(paramType: ArcaParamTypeName): ParamFetcher {
    const fetchers: Record<ArcaParamTypeName, ParamFetcher> = {
      [ArcaParamType.VOUCHER_TYPES]: (auth) => this.wsfe.getVoucherTypes(auth),
      [ArcaParamType.DOCUMENT_TYPES]: (auth) => this.wsfe.getDocumentTypes(auth),
      [ArcaParamType.IVA_RATES]: (auth) => this.wsfe.getIvaRates(auth),
      [ArcaParamType.TRIBUTE_TYPES]: (auth) => this.wsfe.getTributeTypes(auth),
      [ArcaParamType.OPTIONAL_TYPES]: (auth) => this.wsfe.getOptionalTypes(auth),
      [ArcaParamType.RECIPIENT_IVA_CONDITIONS]: (auth) =>
        this.wsfe.getRecipientIvaConditions(auth),
    };
    return fetchers[paramType];
  }

  async get(
    issuer: { id: string; cuit: string },
    paramType: ArcaParamTypeName,
  ): Promise<ArcaParam[]> {
    const cached = await this.prisma.arcaParamCache.findUnique({
      where: { issuerId_paramType: { issuerId: issuer.id, paramType } },
    });
    const stored = cached ? storedParamsSchema.safeParse(cached.entries) : null;
    const isFresh =
      cached && Date.now() - cached.fetchedAt.getTime() < this.cacheTtlMs;

    if (stored?.success && isFresh) {
      return stored.data;
    }

    try {
      const auth = await this.buildAuth(issuer);
      const entries = await this.fetcherFor(paramType)(auth);
      await this.prisma.arcaParamCache.upsert({
        where: { issuerId_paramType: { issuerId: issuer.id, paramType } },
        create: { issuerId: issuer.id, paramType, entries, fetchedAt: new Date() },
        update: { entries, fetchedAt: new Date() },
      });
      return entries;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (stored?.success) {
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

  private async buildAuth(issuer: {
    id: string;
    cuit: string;
  }): Promise<AuthContext> {
    const credentials = await this.certs.getCredentials(issuer.id);
    const accessTicket = await this.wsaa.getAccessTicket(
      issuer.id,
      credentials,
      'wsfe',
    );
    return {
      cuit: issuer.cuit,
      token: accessTicket.token,
      sign: accessTicket.sign,
    };
  }
}
