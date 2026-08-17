import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';
import { buildAuthBlock, callSoap, escapeXml, ParsedXml } from '../arca-soap.util';
import { ArcaRejectionError } from './arca-errors';
import type {
  ArcaParamEntry,
  AuthContext,
  AuthorizedVoucherDetail,
  CaeRequest,
  CaeResult,
  CurrencyInfo,
  ExchangeRateInfo,
  SalesPointInfo,
} from './wsfe.types';

const WSFEV1_NS = 'http://ar.gov.afip.dif.FEV1/';
const BLOCKED_FLAG = 'S';
const EMISSION_TYPE_CAE = 'CAE';

function collectByTag(root: unknown, tag: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (node == null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key === tag) {
        const entries = Array.isArray(value) ? value : [value];
        for (const entry of entries) {
          if (entry && typeof entry === 'object') {
            out.push(entry as Record<string, unknown>);
          }
        }
      } else {
        walk(value);
      }
    }
  };
  walk(root);
  return out;
}

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

const NULL_DATE_MARKERS = ['', 'NULL'];

function isActiveParam(node: Record<string, unknown>): boolean {
  const until = String(node.FchHasta ?? '').trim();
  return NULL_DATE_MARKERS.includes(until.toUpperCase());
}

function isoToArcaDate(iso: string): string {
  return iso.replace(/-/g, '');
}

const num = (n: number): string => n.toFixed(2);

@Injectable()
export class WsfeService {
  private readonly logger = new Logger(WsfeService.name);
  private readonly parser = new XMLParser({ ignoreAttributes: false });

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

  async getSalesPoints(auth: AuthContext): Promise<SalesPointInfo[]> {
    const soap = this.envelope(
      '<ar:FEParamGetPtosVenta>' +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        '</ar:FEParamGetPtosVenta>',
    );
    const res = await callSoap(
      this.wsfeUrl,
      `${WSFEV1_NS}FEParamGetPtosVenta`,
      soap,
    );
    const parsed = this.parser.parse(res) as Record<string, unknown>;
    return collectByTag(parsed, 'PtoVta')
      .filter((node) => this.isActiveCaePoint(node))
      .map((node) => ({
        number: Number(node.Nro),
        emissionType: String(node.EmisionTipo ?? ''),
      }));
  }

  async getVoucherTypeIds(auth: AuthContext): Promise<number[]> {
    const voucherTypes = await this.getVoucherTypes(auth);
    return voucherTypes.map((voucherType) => voucherType.id);
  }

  private async getParamTable(
    auth: AuthContext,
    operation: string,
    tag: string,
  ): Promise<ArcaParamEntry[]> {
    const soap = this.envelope(
      `<ar:${operation}>` +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        `</ar:${operation}>`,
    );
    const res = await callSoap(this.wsfeUrl, `${WSFEV1_NS}${operation}`, soap);
    const parsed = this.parser.parse(res) as Record<string, unknown>;
    return collectByTag(parsed, tag)
      .filter(isActiveParam)
      .map((node) => ({
        id: Number(node.Id),
        description: String(node.Desc ?? ''),
      }))
      .filter((entry) => Number.isFinite(entry.id));
  }

  getDocumentTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, 'FEParamGetTiposDoc', 'DocTipo');
  }

  getIvaRates(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, 'FEParamGetTiposIva', 'IvaTipo');
  }

  getTributeTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, 'FEParamGetTiposTributos', 'TributoTipo');
  }

  getOptionalTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, 'FEParamGetTiposOpcional', 'OpcionalTipo');
  }

  getRecipientIvaConditions(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(
      auth,
      'FEParamGetCondicionIvaReceptor',
      'CondicionIvaReceptor',
    );
  }

  async getVoucherTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, 'FEParamGetTiposCbte', 'CbteTipo');
  }

  async getCurrencies(auth: AuthContext): Promise<CurrencyInfo[]> {
    const soap = this.envelope(
      '<ar:FEParamGetTiposMonedas>' +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        '</ar:FEParamGetTiposMonedas>',
    );
    const res = await callSoap(
      this.wsfeUrl,
      `${WSFEV1_NS}FEParamGetTiposMonedas`,
      soap,
    );
    const parsed = this.parser.parse(res) as Record<string, unknown>;
    return collectByTag(parsed, 'Moneda')
      .filter(isActiveParam)
      .map((node) => ({
        id: String(node.Id ?? ''),
        description: String(node.Desc ?? ''),
      }))
      .filter((currency) => currency.id.length > 0);
  }

  async getExchangeRate(
    auth: AuthContext,
    currencyId: string,
    date?: Date,
  ): Promise<ExchangeRateInfo> {
    const soap = this.envelope(
      '<ar:FEParamGetCotizacion>' +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        `<ar:MonId>${escapeXml(currencyId)}</ar:MonId>` +
        (date ? `<ar:FchCotiz>${toArcaDate(date)}</ar:FchCotiz>` : '') +
        '</ar:FEParamGetCotizacion>',
    );
    const res = await callSoap(
      this.wsfeUrl,
      `${WSFEV1_NS}FEParamGetCotizacion`,
      soap,
    );
    const xml = new ParsedXml(res);
    const errors = xml.errors();
    if (errors.length > 0) {
      throw new ArcaRejectionError(xml.errorCodes(), errors);
    }
    return {
      currencyId,
      rate: Number(xml.required('MonCotiz')),
      date: parseArcaDate(xml.required('FchCotiz')),
    };
  }

  private isActiveCaePoint(node: Record<string, unknown>): boolean {
    const blocked = String(node.Bloqueado ?? '') === BLOCKED_FLAG;
    const fchBaja = String(node.FchBaja ?? '').trim();
    const emissionType = String(node.EmisionTipo ?? '');
    return !blocked && fchBaja.length === 0 && emissionType === EMISSION_TYPE_CAE;
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

  async queryVoucherDetail(
    auth: AuthContext,
    salesPoint: number,
    voucherType: number,
    number: number,
  ): Promise<AuthorizedVoucherDetail | null> {
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
    return {
      cae: { cae, caeVto: parseArcaDate(caeVto) },
      number,
      totalAmount: Number(xml.optional('ImpTotal', '0')),
      recipientDocType: Number(xml.optional('DocTipo', '0')),
      recipientDocNumber: xml.optional('DocNro', ''),
      date: parseArcaDate(xml.required('CbteFch')),
    };
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

  private buildTributes(request: CaeRequest): string {
    const { tributes } = request.amounts;
    if (tributes.length === 0) return '';
    return (
      '<ar:Tributos>' +
      tributes
        .map(
          (tribute) =>
            '<ar:Tributo>' +
            `<ar:Id>${tribute.id}</ar:Id>` +
            `<ar:Desc>${escapeXml(tribute.description)}</ar:Desc>` +
            `<ar:BaseImp>${num(tribute.taxableBase)}</ar:BaseImp>` +
            `<ar:Alic>${num(tribute.rate)}</ar:Alic>` +
            `<ar:Importe>${num(tribute.amount)}</ar:Importe>` +
            '</ar:Tributo>',
        )
        .join('') +
      '</ar:Tributos>'
    );
  }

  private buildServicePeriod(request: CaeRequest): string {
    const { servicePeriod } = request;
    if (!servicePeriod) return '';
    return (
      `<ar:FchServDesde>${isoToArcaDate(servicePeriod.from)}</ar:FchServDesde>` +
      `<ar:FchServHasta>${isoToArcaDate(servicePeriod.to)}</ar:FchServHasta>` +
      `<ar:FchVtoPago>${isoToArcaDate(servicePeriod.paymentDueDate)}</ar:FchVtoPago>`
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
      `<ar:ImpTotConc>${num(amounts.untaxedAmount)}</ar:ImpTotConc>` +
      `<ar:ImpNeto>${num(amounts.netAmount)}</ar:ImpNeto>` +
      `<ar:ImpOpEx>${num(amounts.exemptAmount)}</ar:ImpOpEx>` +
      `<ar:ImpTrib>${num(amounts.tributeAmount)}</ar:ImpTrib>` +
      `<ar:ImpIVA>${num(amounts.ivaAmount)}</ar:ImpIVA>` +
      this.buildServicePeriod(request) +
      `<ar:MonId>${request.currency}</ar:MonId>` +
      `<ar:MonCotiz>${request.exchangeRate}</ar:MonCotiz>` +
      `<ar:CondicionIVAReceptorId>${request.recipient.ivaConditionId}</ar:CondicionIVAReceptorId>` +
      this.buildAssociatedVouchers(request) +
      this.buildTributes(request) +
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
