import { Injectable } from '@nestjs/common';
import { inferFiscalCondition, type FiscalConditionType } from '@chirola/shared';
import { CertsService } from '../certs/certs.service';
import { WsaaService } from '../arca/wsaa/wsaa.service';
import { WsfeService } from '../arca/wsfe/wsfe.service';
import type { AuthContext, SalesPointInfo } from '../arca/wsfe/wsfe.types';

@Injectable()
export class ArcaParamsService {
  constructor(
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
    private readonly wsfe: WsfeService,
  ) {}

  async getSalesPoints(issuer: {
    id: string;
    cuit: string;
  }): Promise<SalesPointInfo[]> {
    const auth = await this.buildAuth(issuer);
    return this.wsfe.getSalesPoints(auth);
  }

  async detectFiscalCondition(issuer: {
    id: string;
    cuit: string;
  }): Promise<{ fiscalCondition: FiscalConditionType | null }> {
    const auth = await this.buildAuth(issuer);
    const voucherTypeIds = await this.wsfe.getVoucherTypeIds(auth);
    return { fiscalCondition: inferFiscalCondition(voucherTypeIds) };
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
