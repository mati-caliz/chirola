import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { TaxpayerAddress, TaxpayerInfo } from '@chirola/shared';
import type { ArcaIssuer } from '../arca/arca-environment';
import { PrismaService } from '../prisma/prisma.service';
import { CertsService } from '../certs/certs.service';
import { WsaaService } from '../arca/wsaa/wsaa.service';
import { PadronService } from '../arca/padron/padron.service';
import type { AuthContext } from '../arca/wsfe/wsfe.types';

const CUIT_LENGTH = 11;
const DEFAULT_CACHE_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const addressSchema = z.object({
  street: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  province: z.string().nullable(),
});

function parseAddress(stored: unknown): TaxpayerAddress | null {
  const parsed = addressSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

function normalizeCuit(cuit: string): string {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== CUIT_LENGTH) {
    throw new BadRequestException('El CUIT debe tener 11 dígitos.');
  }
  return digits;
}

@Injectable()
export class TaxpayersService {
  private readonly cacheTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
    private readonly padron: PadronService,
    config: ConfigService,
  ) {
    this.cacheTtlMs =
      config.get<number>('PADRON_CACHE_TTL_DAYS', DEFAULT_CACHE_TTL_DAYS) *
      MS_PER_DAY;
  }

  async lookup(
    issuer: ArcaIssuer,
    rawCuit: string,
  ): Promise<TaxpayerInfo> {
    const cuit = normalizeCuit(rawCuit);

    const cached = await this.prisma.taxpayerCache.findUnique({ where: { cuit } });
    if (cached && Date.now() - cached.fetchedAt.getTime() < this.cacheTtlMs) {
      return {
        cuit: cached.cuit,
        legalName: cached.legalName,
        status: cached.status,
        ivaConditionId: cached.ivaConditionId,
        address: parseAddress(cached.address),
      };
    }

    const auth = await this.buildAuth(issuer);
    const taxpayer = await this.padron.getTaxpayer(auth, cuit);

    await this.prisma.taxpayerCache.upsert({
      where: { cuit },
      create: {
        cuit,
        legalName: taxpayer.legalName,
        status: taxpayer.status,
        ivaConditionId: taxpayer.ivaConditionId,
        address: taxpayer.address ?? undefined,
        fetchedAt: new Date(),
      },
      update: {
        legalName: taxpayer.legalName,
        status: taxpayer.status,
        ivaConditionId: taxpayer.ivaConditionId,
        address: taxpayer.address ?? undefined,
        fetchedAt: new Date(),
      },
    });

    return taxpayer;
  }

  private async buildAuth(issuer: ArcaIssuer): Promise<AuthContext> {
    const credentials = await this.certs.getCredentials(issuer.id);
    const accessTicket = await this.wsaa.getAccessTicket(
      issuer.id,
      credentials,
      issuer.environment,
      'ws_sr_constancia_inscripcion',
    );
    return {
      issuerId: issuer.id,
      cuit: issuer.cuit,
      token: accessTicket.token,
      sign: accessTicket.sign,
      environment: issuer.environment,
    };
  }
}
