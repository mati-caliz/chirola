import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  buildAuthBlock,
  callSoap,
  escapeXml,
  ParsedXml,
  ARCA_CALL_RECORDER,
  type ArcaCallLogContext,
  type ArcaCallRecorder,
} from "../arca-soap.util";
import { isProduction } from "../arca-environment";
import { collectRecordsByTag, parseXml, xmlText, type XmlRecord } from "../arca-xml";
import { buildCaeDetail, buildCaeHeader } from "./wsfe-request-xml";
import { ArcaRejectionError, assertNoArcaErrors } from "./arca-errors";
import type {
  ArcaParamEntry,
  AuthContext,
  AuthorizedVoucherDetail,
  CaeRequest,
  CaeResult,
  CurrencyInfo,
  ExchangeRateInfo,
  SalesPointInfo,
} from "./wsfe.types";
import { parseArcaDate, toArcaDate } from "../arca-date";

const WSFEV1_NS = "http://ar.gov.afip.dif.FEV1/";
const WSFE_SERVICE = "wsfe";
const BLOCKED_FLAG = "S";
const EMISSION_TYPE_CAE = "CAE";
const SERVER_UP = "OK";

export interface ArcaServerStatus {
  appServer: boolean;
  dbServer: boolean;
  authServer: boolean;
}

const NULL_DATE_MARKERS = ["", "NULL"];

export function emitsCae(emissionType: string): boolean {
  const [mechanism = ""] = emissionType.split("-");
  return mechanism.trim().toUpperCase() === EMISSION_TYPE_CAE;
}

function isNullDate(value: unknown): boolean {
  return NULL_DATE_MARKERS.includes(xmlText(value).trim().toUpperCase());
}

function isActiveParam(node: XmlRecord): boolean {
  return isNullDate(node["FchHasta"]);
}

function isActiveCaePoint(node: XmlRecord): boolean {
  const blocked = xmlText(node["Bloqueado"]) === BLOCKED_FLAG;
  return !blocked && isNullDate(node["FchBaja"]) && emitsCae(xmlText(node["EmisionTipo"]));
}

@Injectable()
export class WsfeService {
  private readonly logger = new Logger(WsfeService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(ARCA_CALL_RECORDER)
    private readonly callLog: ArcaCallRecorder,
  ) {}

  private logContext(issuerId: string | null): ArcaCallLogContext {
    return { issuerId, service: WSFE_SERVICE, recorder: this.callLog };
  }

  private wsfeUrl(environment: string): string {
    return isProduction(environment)
      ? this.config.get<string>("ARCA_WSFEV1_URL_PROD", "https://servicios1.afip.gov.ar/wsfev1/service.asmx")
      : this.config.get<string>("ARCA_WSFEV1_URL_HOMO", "https://wswhomo.afip.gov.ar/wsfev1/service.asmx");
  }

  private envelope(body: string): string {
    return (
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFEV1_NS}">` +
      "<soapenv:Body>" +
      body +
      "</soapenv:Body>" +
      "</soapenv:Envelope>"
    );
  }

  async checkServers(environment: string): Promise<ArcaServerStatus> {
    const soap = this.envelope("<ar:FEDummy/>");
    const res = await callSoap(this.wsfeUrl(environment), `${WSFEV1_NS}FEDummy`, soap, this.logContext(null));
    const xml = new ParsedXml(res);
    const isUp = (tag: string): boolean => xml.optional(tag, "") === SERVER_UP;
    return {
      appServer: isUp("AppServer"),
      dbServer: isUp("DbServer"),
      authServer: isUp("AuthServer"),
    };
  }

  async getLastAuthorized(auth: AuthContext, salesPoint: number, voucherType: number): Promise<number> {
    const soap = this.envelope(
      "<ar:FECompUltimoAutorizado>" +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        `<ar:PtoVta>${salesPoint}</ar:PtoVta>` +
        `<ar:CbteTipo>${voucherType}</ar:CbteTipo>` +
        "</ar:FECompUltimoAutorizado>",
    );
    const res = await callSoap(
      this.wsfeUrl(auth.environment),
      `${WSFEV1_NS}FECompUltimoAutorizado`,
      soap,
      this.logContext(auth.issuerId),
    );
    const xml = new ParsedXml(res);
    assertNoArcaErrors(xml);
    return Number(xml.required("CbteNro"));
  }

  async getSalesPoints(auth: AuthContext): Promise<SalesPointInfo[]> {
    const soap = this.envelope(
      "<ar:FEParamGetPtosVenta>" +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        "</ar:FEParamGetPtosVenta>",
    );
    const res = await callSoap(
      this.wsfeUrl(auth.environment),
      `${WSFEV1_NS}FEParamGetPtosVenta`,
      soap,
      this.logContext(auth.issuerId),
    );
    const parsed = parseXml(res);
    return [...collectRecordsByTag(parsed, "PtoVenta"), ...collectRecordsByTag(parsed, "PtoVta")]
      .filter(isActiveCaePoint)
      .map((node) => ({
        number: Number(node["Nro"]),
        emissionType: xmlText(node["EmisionTipo"]),
      }));
  }

  async getVoucherTypeIds(auth: AuthContext): Promise<number[]> {
    const voucherTypes = await this.getVoucherTypes(auth);
    return voucherTypes.map((voucherType) => voucherType.id);
  }

  private async getParamTable(auth: AuthContext, operation: string, tag: string): Promise<ArcaParamEntry[]> {
    const soap = this.envelope(
      `<ar:${operation}>` + buildAuthBlock(auth.cuit, auth.token, auth.sign) + `</ar:${operation}>`,
    );
    const res = await callSoap(
      this.wsfeUrl(auth.environment),
      `${WSFEV1_NS}${operation}`,
      soap,
      this.logContext(auth.issuerId),
    );
    return collectRecordsByTag(parseXml(res), tag)
      .filter(isActiveParam)
      .map((node) => ({
        id: Number(node["Id"]),
        description: xmlText(node["Desc"]),
      }))
      .filter((entry) => Number.isFinite(entry.id));
  }

  getDocumentTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, "FEParamGetTiposDoc", "DocTipo");
  }

  getIvaRates(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, "FEParamGetTiposIva", "IvaTipo");
  }

  getTributeTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, "FEParamGetTiposTributos", "TributoTipo");
  }

  getOptionalTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, "FEParamGetTiposOpcional", "OpcionalTipo");
  }

  getRecipientIvaConditions(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.getParamTable(auth, "FEParamGetCondicionIvaReceptor", "CondicionIvaReceptor");
  }

  async getVoucherTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return await this.getParamTable(auth, "FEParamGetTiposCbte", "CbteTipo");
  }

  async getCurrencies(auth: AuthContext): Promise<CurrencyInfo[]> {
    const soap = this.envelope(
      "<ar:FEParamGetTiposMonedas>" +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        "</ar:FEParamGetTiposMonedas>",
    );
    const res = await callSoap(
      this.wsfeUrl(auth.environment),
      `${WSFEV1_NS}FEParamGetTiposMonedas`,
      soap,
      this.logContext(auth.issuerId),
    );
    return collectRecordsByTag(parseXml(res), "Moneda")
      .filter(isActiveParam)
      .map((node) => ({
        id: xmlText(node["Id"]),
        description: xmlText(node["Desc"]),
      }))
      .filter((currency) => currency.id.length > 0);
  }

  async getExchangeRate(auth: AuthContext, currencyId: string, date?: Date): Promise<ExchangeRateInfo> {
    const soap = this.envelope(
      "<ar:FEParamGetCotizacion>" +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        `<ar:MonId>${escapeXml(currencyId)}</ar:MonId>` +
        (date === undefined ? "" : `<ar:FchCotiz>${toArcaDate(date)}</ar:FchCotiz>`) +
        "</ar:FEParamGetCotizacion>",
    );
    const res = await callSoap(
      this.wsfeUrl(auth.environment),
      `${WSFEV1_NS}FEParamGetCotizacion`,
      soap,
      this.logContext(auth.issuerId),
    );
    const xml = new ParsedXml(res);
    const errors = xml.errors();
    if (errors.length > 0) {
      throw new ArcaRejectionError(xml.errorCodes(), errors);
    }
    return {
      currencyId,
      rate: Number(xml.required("MonCotiz")),
      date: parseArcaDate(xml.required("FchCotiz")),
    };
  }

  async queryVoucher(
    auth: AuthContext,
    salesPoint: number,
    voucherType: number,
    number: number,
  ): Promise<CaeResult | null> {
    const soap = this.envelope(
      "<ar:FECompConsultar>" +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        "<ar:FeCompConsReq>" +
        `<ar:CbteTipo>${voucherType}</ar:CbteTipo>` +
        `<ar:CbteNro>${number}</ar:CbteNro>` +
        `<ar:PtoVta>${salesPoint}</ar:PtoVta>` +
        "</ar:FeCompConsReq>" +
        "</ar:FECompConsultar>",
    );
    const res = await callSoap(
      this.wsfeUrl(auth.environment),
      `${WSFEV1_NS}FECompConsultar`,
      soap,
      this.logContext(auth.issuerId),
    );
    const xml = new ParsedXml(res);
    const cae = xml.optional("CodAutorizacion", "");
    const caeVto = xml.optional("FchVto", "");
    if (!cae || !caeVto) {
      return null;
    }
    return { cae, caeVto: parseArcaDate(caeVto), observations: xml.observations() };
  }

  async queryVoucherDetail(
    auth: AuthContext,
    salesPoint: number,
    voucherType: number,
    number: number,
  ): Promise<AuthorizedVoucherDetail | null> {
    const soap = this.envelope(
      "<ar:FECompConsultar>" +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        "<ar:FeCompConsReq>" +
        `<ar:CbteTipo>${voucherType}</ar:CbteTipo>` +
        `<ar:CbteNro>${number}</ar:CbteNro>` +
        `<ar:PtoVta>${salesPoint}</ar:PtoVta>` +
        "</ar:FeCompConsReq>" +
        "</ar:FECompConsultar>",
    );
    const res = await callSoap(
      this.wsfeUrl(auth.environment),
      `${WSFEV1_NS}FECompConsultar`,
      soap,
      this.logContext(auth.issuerId),
    );
    const xml = new ParsedXml(res);
    const cae = xml.optional("CodAutorizacion", "");
    const caeVto = xml.optional("FchVto", "");
    if (!cae || !caeVto) {
      return null;
    }
    return {
      cae: {
        cae,
        caeVto: parseArcaDate(caeVto),
        observations: xml.observations(),
      },
      number,
      totalAmount: Number(xml.optional("ImpTotal", "0")),
      recipientDocType: Number(xml.optional("DocTipo", "0")),
      recipientDocNumber: xml.optional("DocNro", ""),
      date: parseArcaDate(xml.required("CbteFch")),
    };
  }

  async requestCae(auth: AuthContext, request: CaeRequest): Promise<CaeResult> {
    const soap = this.envelope(
      "<ar:FECAESolicitar>" +
        buildAuthBlock(auth.cuit, auth.token, auth.sign) +
        "<ar:FeCAEReq>" +
        buildCaeHeader(request) +
        buildCaeDetail(request) +
        "</ar:FeCAEReq>" +
        "</ar:FECAESolicitar>",
    );
    const res = await callSoap(
      this.wsfeUrl(auth.environment),
      `${WSFEV1_NS}FECAESolicitar`,
      soap,
      this.logContext(auth.issuerId),
    );
    return this.parseCaeResponse(res);
  }

  private parseCaeResponse(res: string): CaeResult {
    const xml = new ParsedXml(res);
    assertNoArcaErrors(xml);
    const result = xml.required("Resultado");
    if (result === "R") {
      throw new ArcaRejectionError(xml.errorCodes(), xml.errors());
    }
    const cae = xml.required("CAE");
    const caeVto = xml.required("CAEFchVto");
    const observations = xml.observations();
    this.logger.log(`CAE otorgado: ${cae} (vence ${caeVto})`);
    if (observations.length > 0) {
      this.logger.warn(
        `ARCA autorizó con observaciones: ${observations
          .map(({ code, message }) => `(${code}) ${message}`)
          .join(" · ")}`,
      );
    }
    return { cae, caeVto: parseArcaDate(caeVto), observations };
  }
}
