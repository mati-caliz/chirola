import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';
import { exportItemTotal } from '@chirola/shared';
import {
  callSoap,
  escapeXml,
  ParsedXml,
  ARCA_CALL_RECORDER,
  type ArcaCallLogContext,
  type ArcaCallRecorder,
} from '../arca-soap.util';
import { isProduction } from '../arca-environment';
import type { ArcaParamEntry, AuthContext } from '../wsfe/wsfe.types';
import { WsfexRejectionError } from './wsfex-errors';
import type { ExportCaeRequest, ExportCaeResult } from './wsfex.types';

const WSFEX_NS = 'http://ar.gov.afip.dif.fexv1/';
const WSFEX_SERVICE = 'wsfex';
const NO_ERROR_CODE = '0';
const REPROCESSED_FLAG = 'S';
const APPROVED_RESULT = 'A';

function toArcaDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function parseArcaDate(value: string): Date {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  return new Date(year, month - 1, day);
}

const num = (value: number): string => value.toFixed(2);

function collectByTag(root: unknown, tag: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (node == null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === tag) {
        for (const entry of Array.isArray(value) ? value : [value]) {
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

@Injectable()
export class WsfexService {
  private readonly logger = new Logger(WsfexService.name);
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  constructor(
    private readonly config: ConfigService,
    @Inject(ARCA_CALL_RECORDER)
    private readonly callLog: ArcaCallRecorder,
  ) {}

  private logContext(issuerId: string | null): ArcaCallLogContext {
    return { issuerId, service: WSFEX_SERVICE, recorder: this.callLog };
  }

  private wsfexUrl(environment: string): string {
    return isProduction(environment)
      ? this.config.get<string>(
          'ARCA_WSFEX_URL_PROD',
          'https://servicios1.afip.gov.ar/wsfexv1/service.asmx',
        )
      : this.config.get<string>(
          'ARCA_WSFEX_URL_HOMO',
          'https://wswhomo.afip.gov.ar/wsfexv1/service.asmx',
        );
  }

  private envelope(body: string): string {
    return (
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFEX_NS}">` +
      '<soapenv:Body>' +
      body +
      '</soapenv:Body>' +
      '</soapenv:Envelope>'
    );
  }

  private authBlock(auth: AuthContext): string {
    return (
      '<ar:Auth>' +
      `<ar:Token>${escapeXml(auth.token)}</ar:Token>` +
      `<ar:Sign>${escapeXml(auth.sign)}</ar:Sign>` +
      `<ar:Cuit>${auth.cuit}</ar:Cuit>` +
      '</ar:Auth>'
    );
  }

  private async call(
    auth: AuthContext,
    operation: string,
    body: string,
  ): Promise<ParsedXml> {
    const response = await callSoap(
      this.wsfexUrl(auth.environment),
      `${WSFEX_NS}${operation}`,
      this.envelope(body),
      this.logContext(auth.issuerId),
    );
    return new ParsedXml(response);
  }

  private assertNoError(xml: ParsedXml): void {
    const code = xml.optional('ErrCode', NO_ERROR_CODE);
    if (code !== NO_ERROR_CODE) {
      const message = xml.optional('ErrMsg', 'Error sin detalle');
      throw new WsfexRejectionError([code], [`(${code}) ${message}`]);
    }
  }

  async ping(environment: string): Promise<boolean> {
    const response = await callSoap(
      this.wsfexUrl(environment),
      `${WSFEX_NS}FEXDummy`,
      this.envelope('<ar:FEXDummy/>'),
      this.logContext(null),
    );
    return response.includes('OK');
  }

  async getLastRequestId(auth: AuthContext): Promise<number> {
    const xml = await this.call(
      auth,
      'FEXGetLast_ID',
      `<ar:FEXGetLast_ID>${this.authBlock(auth)}</ar:FEXGetLast_ID>`,
    );
    this.assertNoError(xml);
    return Number(xml.optional('Id', '0'));
  }

  async getLastAuthorized(
    auth: AuthContext,
    salesPoint: number,
    voucherType: number,
  ): Promise<number> {
    const xml = await this.call(
      auth,
      'FEXGetLast_CMP',
      '<ar:FEXGetLast_CMP><ar:Auth_Req>' +
        `<ar:Token>${escapeXml(auth.token)}</ar:Token>` +
        `<ar:Sign>${escapeXml(auth.sign)}</ar:Sign>` +
        `<ar:Cuit>${auth.cuit}</ar:Cuit>` +
        `<ar:Pto_venta>${salesPoint}</ar:Pto_venta>` +
        `<ar:Cbte_Tipo>${voucherType}</ar:Cbte_Tipo>` +
        '</ar:Auth_Req></ar:FEXGetLast_CMP>',
    );
    this.assertNoError(xml);
    return Number(xml.optional('Cbte_nro', '0'));
  }

  private paramTable(
    auth: AuthContext,
    operation: string,
    tag: string,
    idField: string,
    descriptionField: string,
  ): Promise<ArcaParamEntry[]> {
    return this.call(
      auth,
      operation,
      `<ar:${operation}>${this.authBlock(auth)}</ar:${operation}>`,
    ).then((xml) => {
      this.assertNoError(xml);
      return collectByTag(xml.raw(), tag)
        .map((node) => ({
          id: Number(node[idField]),
          description: String(node[descriptionField] ?? ''),
        }))
        .filter((entry) => Number.isFinite(entry.id));
    });
  }

  getCountries(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.paramTable(
      auth,
      'FEXGetPARAM_DST_pais',
      'ClsFEXResponse_DST_pais',
      'DST_Codigo',
      'DST_Ds',
    );
  }

  getUnitsOfMeasure(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.paramTable(
      auth,
      'FEXGetPARAM_UMed',
      'ClsFEXResponse_UMed',
      'Umed_Id',
      'Umed_Ds',
    );
  }

  getExportTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.paramTable(
      auth,
      'FEXGetPARAM_Tipo_Expo',
      'ClsFEXResponse_Tex',
      'Tex_Id',
      'Tex_Ds',
    );
  }

  async getCountryTaxIds(auth: AuthContext): Promise<ArcaParamEntry[]> {
    const xml = await this.call(
      auth,
      'FEXGetPARAM_DST_CUIT',
      `<ar:FEXGetPARAM_DST_CUIT>${this.authBlock(auth)}</ar:FEXGetPARAM_DST_CUIT>`,
    );
    this.assertNoError(xml);
    return collectByTag(xml.raw(), 'ClsFEXResponse_DST_cuit')
      .map((node) => ({
        id: Number(node.DST_CUIT),
        description: String(node.DST_Ds ?? ''),
      }))
      .filter((entry) => Number.isFinite(entry.id));
  }

  async getIncoterms(auth: AuthContext): Promise<ArcaParamEntry[]> {
    const xml = await this.call(
      auth,
      'FEXGetPARAM_Incoterms',
      `<ar:FEXGetPARAM_Incoterms>${this.authBlock(auth)}</ar:FEXGetPARAM_Incoterms>`,
    );
    this.assertNoError(xml);
    return collectByTag(xml.raw(), 'ClsFEXResponse_Inc').map((node, index) => ({
      id: index,
      description: `${String(node.Inc_Id ?? '')} — ${String(node.Inc_Ds ?? '')}`,
    }));
  }

  async authorize(
    auth: AuthContext,
    request: ExportCaeRequest,
  ): Promise<ExportCaeResult> {
    const xml = await this.call(
      auth,
      'FEXAuthorize',
      '<ar:FEXAuthorize>' +
        this.authBlock(auth) +
        this.buildRequest(request) +
        '</ar:FEXAuthorize>',
    );
    return this.parseAuthorizeResponse(xml);
  }

  buildRequest(request: ExportCaeRequest): string {
    return (
      '<ar:Cmp>' +
      `<ar:Id>${request.requestId}</ar:Id>` +
      `<ar:Fecha_cbte>${toArcaDate(request.date)}</ar:Fecha_cbte>` +
      `<ar:Cbte_tipo>${request.voucherType}</ar:Cbte_tipo>` +
      `<ar:Punto_vta>${request.salesPoint}</ar:Punto_vta>` +
      `<ar:Cbte_nro>${request.number}</ar:Cbte_nro>` +
      `<ar:Tipo_expo>${request.exportType}</ar:Tipo_expo>` +
      this.buildShippingPermits(request) +
      `<ar:Dst_cmp>${request.destinationCountryId}</ar:Dst_cmp>` +
      `<ar:Cliente>${escapeXml(request.client.legalName)}</ar:Cliente>` +
      `<ar:Cuit_pais_cliente>${request.countryTaxId}</ar:Cuit_pais_cliente>` +
      `<ar:Domicilio_cliente>${escapeXml(request.client.address)}</ar:Domicilio_cliente>` +
      (request.client.taxId
        ? `<ar:Id_impositivo>${escapeXml(request.client.taxId)}</ar:Id_impositivo>`
        : '') +
      `<ar:Moneda_Id>${escapeXml(request.currency)}</ar:Moneda_Id>` +
      `<ar:Moneda_ctz>${request.exchangeRate}</ar:Moneda_ctz>` +
      (request.commercialNotes
        ? `<ar:Obs_comerciales>${escapeXml(request.commercialNotes)}</ar:Obs_comerciales>`
        : '') +
      `<ar:Imp_total>${num(request.totalAmount)}</ar:Imp_total>` +
      (request.notes ? `<ar:Obs>${escapeXml(request.notes)}</ar:Obs>` : '') +
      (request.paymentMethod
        ? `<ar:Forma_pago>${escapeXml(request.paymentMethod)}</ar:Forma_pago>`
        : '') +
      (request.incoterm
        ? `<ar:Incoterms>${escapeXml(request.incoterm)}</ar:Incoterms>`
        : '') +
      (request.incotermDescription
        ? `<ar:Incoterms_Ds>${escapeXml(request.incotermDescription)}</ar:Incoterms_Ds>`
        : '') +
      `<ar:Idioma_cbte>${request.language}</ar:Idioma_cbte>` +
      this.buildItems(request) +
      this.buildAssociatedVouchers(request) +
      '</ar:Cmp>'
    );
  }

  private buildShippingPermits(request: ExportCaeRequest): string {
    if (request.shippingPermits.length === 0) {
      return '<ar:Permiso_existente>N</ar:Permiso_existente>';
    }
    return (
      '<ar:Permiso_existente>S</ar:Permiso_existente>' +
      '<ar:Permisos>' +
      request.shippingPermits
        .map(
          (permit) =>
            '<ar:Permiso>' +
            `<ar:Id_permiso>${escapeXml(permit.permitId)}</ar:Id_permiso>` +
            `<ar:Dst_merc>${permit.destinationCountryId}</ar:Dst_merc>` +
            '</ar:Permiso>',
        )
        .join('') +
      '</ar:Permisos>'
    );
  }

  private buildItems(request: ExportCaeRequest): string {
    return (
      '<ar:Items>' +
      request.items
        .map(
          (item) =>
            '<ar:Item>' +
            (item.code
              ? `<ar:Pro_codigo>${escapeXml(item.code)}</ar:Pro_codigo>`
              : '') +
            `<ar:Pro_ds>${escapeXml(item.description)}</ar:Pro_ds>` +
            `<ar:Pro_qty>${item.quantity}</ar:Pro_qty>` +
            `<ar:Pro_umed>${item.unitOfMeasureId}</ar:Pro_umed>` +
            `<ar:Pro_precio_uni>${item.unitPrice}</ar:Pro_precio_uni>` +
            `<ar:Pro_bonificacion>${num(item.discount)}</ar:Pro_bonificacion>` +
            `<ar:Pro_total_item>${num(exportItemTotal(item))}</ar:Pro_total_item>` +
            '</ar:Item>',
        )
        .join('') +
      '</ar:Items>'
    );
  }

  private buildAssociatedVouchers(request: ExportCaeRequest): string {
    if (request.associatedVouchers.length === 0) return '';
    return (
      '<ar:Cmps_asoc>' +
      request.associatedVouchers
        .map(
          (voucher) =>
            '<ar:Cmp_asoc>' +
            `<ar:Cbte_tipo>${voucher.type}</ar:Cbte_tipo>` +
            `<ar:Cbte_punto_vta>${voucher.salesPoint}</ar:Cbte_punto_vta>` +
            `<ar:Cbte_nro>${voucher.number}</ar:Cbte_nro>` +
            '</ar:Cmp_asoc>',
        )
        .join('') +
      '</ar:Cmps_asoc>'
    );
  }

  parseAuthorizeResponse(xml: ParsedXml): ExportCaeResult {
    this.assertNoError(xml);

    const result = xml.optional('Resultado', '');
    if (result && result !== APPROVED_RESULT) {
      const observations = xml.observations();
      throw new WsfexRejectionError(
        observations.map(({ code }) => code),
        observations.map(({ code, message }) => `(${code}) ${message}`),
      );
    }

    const cae = xml.required('Cae');
    const caeVto = xml.required('Fch_venc_Cae');
    const reprocessed = xml.optional('Reproceso', '') === REPROCESSED_FLAG;
    const observations = xml.observations();

    if (reprocessed) {
      this.logger.warn(
        `ARCA devolvió un comprobante de exportación ya emitido (reproceso), CAE ${cae}.`,
      );
    }
    if (observations.length > 0) {
      this.logger.warn(
        `Exportación autorizada con observaciones: ${observations
          .map(({ code, message }) => `(${code}) ${message}`)
          .join(' · ')}`,
      );
    }

    return {
      cae,
      caeVto: parseArcaDate(caeVto),
      observations,
      reprocessed,
    };
  }
}
