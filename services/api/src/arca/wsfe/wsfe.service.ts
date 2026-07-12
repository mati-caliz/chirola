import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildAuthBlock, callSoap, ParsedXml } from '../arca-soap.util';
import { ArcaRejectionError } from './arca-errors';
import type {
  AuthContext,
  CaeRequest,
  CaeResult,
} from './wsfe.types';

const WSFEV1_NS = 'http://ar.gov.afip.dif.FEV1/';

function toArcaDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function parseArcaDate(s: string): Date {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  return new Date(y, m - 1, d);
}

const num = (n: number): string => n.toFixed(2);

@Injectable()
export class WsfeService {
  private readonly logger = new Logger(WsfeService.name);

  constructor(private readonly config: ConfigService) {}

  private get wsfeUrl(): string {
    const env = this.config.get<string>('ARCA_ENV', 'homologacion');
    return env === 'produccion'
      ? this.config.get<string>(
          'ARCA_WSFEV1_URL_PROD',
          'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
        )
      : this.config.get<string>(
          'ARCA_WSFEV1_URL_HOMO',
          'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
        );
  }

  private envelope(body: string): string {
    return (
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFEV1_NS}">` +
      '<soapenv:Body>' +
      body +
      '</soapenv:Body>' +
      '</soapenv:Envelope>'
    );
  }

  async ping(): Promise<boolean> {
    const soap = this.envelope('<ar:FEDummy/>');
    const res = await callSoap(this.wsfeUrl, `${WSFEV1_NS}FEDummy`, soap);
    return res.includes('OK');
  }

  async getLastAuthorized(
    auth: AuthContext,
    salesPoint: number,
    voucherType: number,
  ): Promise<number> {
    const soap = this.envelope(
      '<ar:FECompUltimoAutorizado>' +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        `<ar:PtoVta>${salesPoint}</ar:PtoVta>` +
        `<ar:CbteTipo>${voucherType}</ar:CbteTipo>` +
        '</ar:FECompUltimoAutorizado>',
    );
    const res = await callSoap(
      this.wsfeUrl,
      `${WSFEV1_NS}FECompUltimoAutorizado`,
      soap,
    );
    const xml = new ParsedXml(res);
    return Number(xml.required('CbteNro'));
  }

  async queryVoucher(
    auth: AuthContext,
    salesPoint: number,
    voucherType: number,
    number: number,
  ): Promise<CaeResult | null> {
    const soap = this.envelope(
      '<ar:FECompConsultar>' +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        '<ar:FeCompConsReq>' +
        `<ar:CbteTipo>${voucherType}</ar:CbteTipo>` +
        `<ar:CbteNro>${number}</ar:CbteNro>` +
        `<ar:PtoVta>${salesPoint}</ar:PtoVta>` +
        '</ar:FeCompConsReq>' +
        '</ar:FECompConsultar>',
    );
    const res = await callSoap(
      this.wsfeUrl,
      `${WSFEV1_NS}FECompConsultar`,
      soap,
    );
    const xml = new ParsedXml(res);
    const cae = xml.optional('CodAutorizacion', '');
    const caeVto = xml.optional('FchVto', '');
    if (!cae || !caeVto) {
      return null;
    }
    return { cae, caeVto: parseArcaDate(caeVto) };
  }

  async requestCae(auth: AuthContext, request: CaeRequest): Promise<CaeResult> {
    const soap = this.envelope(
      '<ar:FECAESolicitar>' +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        '<ar:FeCAEReq>' +
        this.buildHeader(request) +
        this.buildDetail(request) +
        '</ar:FeCAEReq>' +
        '</ar:FECAESolicitar>',
    );
    const res = await callSoap(this.wsfeUrl, `${WSFEV1_NS}FECAESolicitar`, soap);
    return this.parseCaeResponse(res);
  }

  private buildHeader(request: CaeRequest): string {
    return (
      '<ar:FeCabReq>' +
      '<ar:CantReg>1</ar:CantReg>' +
      `<ar:PtoVta>${request.salesPoint}</ar:PtoVta>` +
      `<ar:CbteTipo>${request.voucherType}</ar:CbteTipo>` +
      '</ar:FeCabReq>'
    );
  }

  private buildAssociatedVouchers(request: CaeRequest): string {
    const associated = request.associatedVouchers ?? [];
    if (associated.length === 0) return '';
    return (
      '<ar:CbtesAsoc>' +
      associated
        .map(
          (voucher) =>
            '<ar:CbteAsoc>' +
            `<ar:Tipo>${voucher.type}</ar:Tipo>` +
            `<ar:PtoVta>${voucher.salesPoint}</ar:PtoVta>` +
            `<ar:Nro>${voucher.number}</ar:Nro>` +
            (voucher.cuit ? `<ar:Cuit>${voucher.cuit}</ar:Cuit>` : '') +
            (voucher.date ? `<ar:CbteFch>${voucher.date}</ar:CbteFch>` : '') +
            '</ar:CbteAsoc>',
        )
        .join('') +
      '</ar:CbtesAsoc>'
    );
  }

  private buildDetail(request: CaeRequest): string {
    const { amounts } = request;
    const ivaArray =
      amounts.rates.length > 0
        ? '<ar:Iva>' +
          amounts.rates
            .map(
              (rate) =>
                '<ar:AlicIva>' +
                `<ar:Id>${rate.id}</ar:Id>` +
                `<ar:BaseImp>${num(rate.taxableBase)}</ar:BaseImp>` +
                `<ar:Importe>${num(rate.amount)}</ar:Importe>` +
                '</ar:AlicIva>',
            )
            .join('') +
          '</ar:Iva>'
        : '';

    return (
      '<ar:FeDetReq>' +
      '<ar:FECAEDetRequest>' +
      `<ar:Concepto>${request.concept}</ar:Concepto>` +
      `<ar:DocTipo>${request.recipient.docType}</ar:DocTipo>` +
      `<ar:DocNro>${request.recipient.docNumber.replace(/-/g, '')}</ar:DocNro>` +
      `<ar:CbteDesde>${request.number}</ar:CbteDesde>` +
      `<ar:CbteHasta>${request.number}</ar:CbteHasta>` +
      `<ar:CbteFch>${toArcaDate(request.date)}</ar:CbteFch>` +
      `<ar:ImpTotal>${num(amounts.totalAmount)}</ar:ImpTotal>` +
      '<ar:ImpTotConc>0</ar:ImpTotConc>' +
      `<ar:ImpNeto>${num(amounts.netAmount)}</ar:ImpNeto>` +
      '<ar:ImpOpEx>0</ar:ImpOpEx>' +
      `<ar:ImpIVA>${num(amounts.ivaAmount)}</ar:ImpIVA>` +
      '<ar:ImpTrib>0</ar:ImpTrib>' +
      `<ar:MonId>${request.currency}</ar:MonId>` +
      `<ar:MonCotiz>${request.exchangeRate}</ar:MonCotiz>` +
      `<ar:CondicionIVAReceptorId>${request.recipient.ivaConditionId}</ar:CondicionIVAReceptorId>` +
      this.buildAssociatedVouchers(request) +
      ivaArray +
      '</ar:FECAEDetRequest>' +
      '</ar:FeDetReq>'
    );
  }

  private parseCaeResponse(res: string): CaeResult {
    const xml = new ParsedXml(res);
    const result = xml.required('Resultado');
    if (result === 'R') {
      throw new ArcaRejectionError(xml.errorCodes(), xml.errors());
    }
    const cae = xml.required('CAE');
    const caeVto = xml.required('CAEFchVto');
    this.logger.log(`CAE otorgado: ${cae} (vence ${caeVto})`);
    return { cae, caeVto: parseArcaDate(caeVto) };
  }
}
