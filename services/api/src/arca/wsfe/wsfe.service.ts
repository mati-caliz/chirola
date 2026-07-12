import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildAuthBlock, callSoap, ParsedXml } from '../arca-soap.util';
import type {
  AuthContext,
  CaeRequest,
  CaeResult,
} from './wsfe.types';

const WSFEV1_NS = 'http://ar.gov.afip.dif.FEV1/';

/** Formatea una fecha como `yyyyMMdd`, como espera WSFEv1. */
function fechaArca(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Parsea `yyyyMMdd` a Date (medianoche local). */
function parseFechaArca(s: string): Date {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  return new Date(y, m - 1, d);
}

const num = (n: number): string => n.toFixed(2);

/**
 * Cliente self-host de WSFEv1 (Facturación Electrónica de ARCA).
 *
 * Portado de la implementación probada en producción de gastronova. Arma los
 * envelopes SOAP a mano (ARCA no expone una API apta para consumir de otra
 * forma cómoda) y delega auth/parseo en utilitarios compartidos.
 */
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

  /** Verifica conectividad y estado del servicio (FEDummy). */
  async ping(): Promise<boolean> {
    const soap = this.envelope('<ar:FEDummy/>');
    const res = await callSoap(this.wsfeUrl, `${WSFEV1_NS}FEDummy`, soap);
    return res.includes('OK');
  }

  /** Último número autorizado para (punto de venta, tipo de comprobante). */
  async getUltimoAutorizado(
    auth: AuthContext,
    puntoVenta: number,
    tipoCbte: number,
  ): Promise<number> {
    const soap = this.envelope(
      '<ar:FECompUltimoAutorizado>' +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        `<ar:PtoVta>${puntoVenta}</ar:PtoVta>` +
        `<ar:CbteTipo>${tipoCbte}</ar:CbteTipo>` +
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

  /**
   * Solicita el CAE de un comprobante (FECAESolicitar).
   * El número debe ser el siguiente correlativo (ver getUltimoAutorizado + 1).
   */
  async solicitarCae(auth: AuthContext, req: CaeRequest): Promise<CaeResult> {
    const soap = this.envelope(
      '<ar:FECAESolicitar>' +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        '<ar:FeCAEReq>' +
        this.buildCabecera(req) +
        this.buildDetalle(req) +
        '</ar:FeCAEReq>' +
        '</ar:FECAESolicitar>',
    );
    const res = await callSoap(this.wsfeUrl, `${WSFEV1_NS}FECAESolicitar`, soap);
    return this.parseCaeResponse(res);
  }

  private buildCabecera(req: CaeRequest): string {
    return (
      '<ar:FeCabReq>' +
      '<ar:CantReg>1</ar:CantReg>' +
      `<ar:PtoVta>${req.puntoVenta}</ar:PtoVta>` +
      `<ar:CbteTipo>${req.tipoCbte}</ar:CbteTipo>` +
      '</ar:FeCabReq>'
    );
  }

  private buildDetalle(req: CaeRequest): string {
    const { importes } = req;
    const ivaArray =
      importes.alicuotas.length > 0
        ? '<ar:Iva>' +
          importes.alicuotas
            .map(
              (a) =>
                '<ar:AlicIva>' +
                `<ar:Id>${a.id}</ar:Id>` +
                `<ar:BaseImp>${num(a.baseImp)}</ar:BaseImp>` +
                `<ar:Importe>${num(a.importe)}</ar:Importe>` +
                '</ar:AlicIva>',
            )
            .join('') +
          '</ar:Iva>'
        : '';

    return (
      '<ar:FeDetReq>' +
      '<ar:FECAEDetRequest>' +
      `<ar:Concepto>${req.concepto}</ar:Concepto>` +
      `<ar:DocTipo>${req.receptor.tipoDoc}</ar:DocTipo>` +
      `<ar:DocNro>${req.receptor.numeroDoc.replace(/-/g, '')}</ar:DocNro>` +
      `<ar:CbteDesde>${req.numero}</ar:CbteDesde>` +
      `<ar:CbteHasta>${req.numero}</ar:CbteHasta>` +
      `<ar:CbteFch>${fechaArca(req.fecha)}</ar:CbteFch>` +
      `<ar:ImpTotal>${num(importes.impTotal)}</ar:ImpTotal>` +
      '<ar:ImpTotConc>0</ar:ImpTotConc>' +
      `<ar:ImpNeto>${num(importes.impNeto)}</ar:ImpNeto>` +
      '<ar:ImpOpEx>0</ar:ImpOpEx>' +
      `<ar:ImpIVA>${num(importes.impIva)}</ar:ImpIVA>` +
      '<ar:ImpTrib>0</ar:ImpTrib>' +
      `<ar:MonId>${req.moneda}</ar:MonId>` +
      `<ar:MonCotiz>${req.cotizacion}</ar:MonCotiz>` +
      `<ar:CondicionIVAReceptorId>${req.receptor.condicionIvaId}</ar:CondicionIVAReceptorId>` +
      ivaArray +
      '</ar:FECAEDetRequest>' +
      '</ar:FeDetReq>'
    );
  }

  private parseCaeResponse(res: string): CaeResult {
    const xml = new ParsedXml(res);
    const resultado = xml.required('Resultado');
    if (resultado === 'R') {
      const errores = xml.errors();
      throw new BadRequestException(
        `ARCA rechazó el comprobante: ${
          errores.length ? errores.join(' | ') : 'motivo desconocido'
        }`,
      );
    }
    const cae = xml.required('CAE');
    const caeVto = xml.required('CAEFchVto');
    this.logger.log(`CAE otorgado: ${cae} (vence ${caeVto})`);
    return { cae, caeVto: parseFechaArca(caeVto) };
  }
}
