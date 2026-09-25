import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { exportItemTotal, hasText } from "@chirola/shared";
import {
  callSoap,
  escapeXml,
  ParsedXml,
  ARCA_CALL_RECORDER,
  type ArcaCallLogContext,
  type ArcaCallRecorder,
} from "../arca-soap.util";
import { isProduction } from "../arca-environment";
import { collectRecordsByTag, xmlText } from "../arca-xml";
import type { ArcaParamEntry, AuthContext } from "../wsfe/wsfe.types";
import { WsfexRejectionError } from "./wsfex-errors";
import type { ExportCaeRequest, ExportCaeResult } from "./wsfex.types";
import { parseArcaDate, toArcaDate } from "../arca-date";

const WSFEX_NS = "http://ar.gov.afip.dif.fexv1/";
const WSFEX_SERVICE = "wsfex";
const NO_ERROR_CODE = "0";
const REPROCESSED_FLAG = "S";
const APPROVED_RESULT = "A";

const num = (value: number): string => value.toFixed(2);

interface ParamTableSpec {
  operation: string;
  tag: string;
  idField: string;
  descriptionField: string;
}

function optionalElement(tag: string, value: string | undefined): string {
  return hasText(value) ? `<ar:${tag}>${escapeXml(value)}</ar:${tag}>` : "";
}

@Injectable()
export class WsfexService {
  private readonly logger = new Logger(WsfexService.name);

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
      ? this.config.get<string>("ARCA_WSFEX_URL_PROD", "https://servicios1.afip.gov.ar/wsfexv1/service.asmx")
      : this.config.get<string>("ARCA_WSFEX_URL_HOMO", "https://wswhomo.afip.gov.ar/wsfexv1/service.asmx");
  }

  private envelope(body: string): string {
    return (
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFEX_NS}">` +
      "<soapenv:Body>" +
      body +
      "</soapenv:Body>" +
      "</soapenv:Envelope>"
    );
  }

  private authBlock(auth: AuthContext): string {
    return (
      "<ar:Auth>" +
      `<ar:Token>${escapeXml(auth.token)}</ar:Token>` +
      `<ar:Sign>${escapeXml(auth.sign)}</ar:Sign>` +
      `<ar:Cuit>${auth.cuit}</ar:Cuit>` +
      "</ar:Auth>"
    );
  }

  private async call(auth: AuthContext, operation: string, body: string): Promise<ParsedXml> {
    const response = await callSoap(
      this.wsfexUrl(auth.environment),
      `${WSFEX_NS}${operation}`,
      this.envelope(body),
      this.logContext(auth.issuerId),
    );
    return new ParsedXml(response);
  }

  private assertNoError(xml: ParsedXml): void {
    const code = xml.optional("ErrCode", NO_ERROR_CODE);
    if (code !== NO_ERROR_CODE) {
      const message = xml.optional("ErrMsg", "Error sin detalle");
      throw new WsfexRejectionError([code], [`(${code}) ${message}`]);
    }
  }

  async ping(environment: string): Promise<boolean> {
    const response = await callSoap(
      this.wsfexUrl(environment),
      `${WSFEX_NS}FEXDummy`,
      this.envelope("<ar:FEXDummy/>"),
      this.logContext(null),
    );
    return response.includes("OK");
  }

  async getLastRequestId(auth: AuthContext): Promise<number> {
    const xml = await this.call(
      auth,
      "FEXGetLast_ID",
      `<ar:FEXGetLast_ID>${this.authBlock(auth)}</ar:FEXGetLast_ID>`,
    );
    this.assertNoError(xml);
    return Number(xml.optional("Id", "0"));
  }

  async getLastAuthorized(auth: AuthContext, salesPoint: number, voucherType: number): Promise<number> {
    const xml = await this.call(
      auth,
      "FEXGetLast_CMP",
      "<ar:FEXGetLast_CMP><ar:Auth_Req>" +
        `<ar:Token>${escapeXml(auth.token)}</ar:Token>` +
        `<ar:Sign>${escapeXml(auth.sign)}</ar:Sign>` +
        `<ar:Cuit>${auth.cuit}</ar:Cuit>` +
        `<ar:Pto_venta>${salesPoint}</ar:Pto_venta>` +
        `<ar:Cbte_Tipo>${voucherType}</ar:Cbte_Tipo>` +
        "</ar:Auth_Req></ar:FEXGetLast_CMP>",
    );
    this.assertNoError(xml);
    return Number(xml.optional("Cbte_nro", "0"));
  }

  private paramTable(auth: AuthContext, table: ParamTableSpec): Promise<ArcaParamEntry[]> {
    const { operation, tag, idField, descriptionField } = table;
    return this.call(auth, operation, `<ar:${operation}>${this.authBlock(auth)}</ar:${operation}>`).then(
      (xml) => {
        this.assertNoError(xml);
        return collectRecordsByTag(xml.raw(), tag)
          .map((node) => ({
            id: Number(node[idField]),
            description: xmlText(node[descriptionField]),
          }))
          .filter((entry) => Number.isFinite(entry.id));
      },
    );
  }

  getCountries(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.paramTable(auth, {
      operation: "FEXGetPARAM_DST_pais",
      tag: "ClsFEXResponse_DST_pais",
      idField: "DST_Codigo",
      descriptionField: "DST_Ds",
    });
  }

  getUnitsOfMeasure(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.paramTable(auth, {
      operation: "FEXGetPARAM_UMed",
      tag: "ClsFEXResponse_UMed",
      idField: "Umed_Id",
      descriptionField: "Umed_Ds",
    });
  }

  getExportTypes(auth: AuthContext): Promise<ArcaParamEntry[]> {
    return this.paramTable(auth, {
      operation: "FEXGetPARAM_Tipo_Expo",
      tag: "ClsFEXResponse_Tex",
      idField: "Tex_Id",
      descriptionField: "Tex_Ds",
    });
  }

  async getCountryTaxIds(auth: AuthContext): Promise<ArcaParamEntry[]> {
    const xml = await this.call(
      auth,
      "FEXGetPARAM_DST_CUIT",
      `<ar:FEXGetPARAM_DST_CUIT>${this.authBlock(auth)}</ar:FEXGetPARAM_DST_CUIT>`,
    );
    this.assertNoError(xml);
    return collectRecordsByTag(xml.raw(), "ClsFEXResponse_DST_cuit")
      .map((node) => ({
        id: Number(node["DST_CUIT"]),
        description: xmlText(node["DST_Ds"]),
      }))
      .filter((entry) => Number.isFinite(entry.id));
  }

  async getIncoterms(auth: AuthContext): Promise<ArcaParamEntry[]> {
    const xml = await this.call(
      auth,
      "FEXGetPARAM_Incoterms",
      `<ar:FEXGetPARAM_Incoterms>${this.authBlock(auth)}</ar:FEXGetPARAM_Incoterms>`,
    );
    this.assertNoError(xml);
    return collectRecordsByTag(xml.raw(), "ClsFEXResponse_Inc").map((node, index) => ({
      id: index,
      description: `${xmlText(node["Inc_Id"])} — ${xmlText(node["Inc_Ds"])}`,
    }));
  }

  async authorize(auth: AuthContext, request: ExportCaeRequest): Promise<ExportCaeResult> {
    const xml = await this.call(
      auth,
      "FEXAuthorize",
      "<ar:FEXAuthorize>" + this.authBlock(auth) + this.buildRequest(request) + "</ar:FEXAuthorize>",
    );
    return this.parseAuthorizeResponse(xml);
  }

  buildRequest(request: ExportCaeRequest): string {
    return (
      "<ar:Cmp>" +
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
      optionalElement("Id_impositivo", request.client.taxId) +
      `<ar:Moneda_Id>${escapeXml(request.currency)}</ar:Moneda_Id>` +
      `<ar:Moneda_ctz>${request.exchangeRate}</ar:Moneda_ctz>` +
      optionalElement("Obs_comerciales", request.commercialNotes) +
      `<ar:Imp_total>${num(request.totalAmount)}</ar:Imp_total>` +
      optionalElement("Obs", request.notes) +
      optionalElement("Forma_pago", request.paymentMethod) +
      optionalElement("Incoterms", request.incoterm) +
      optionalElement("Incoterms_Ds", request.incotermDescription) +
      `<ar:Idioma_cbte>${request.language}</ar:Idioma_cbte>` +
      this.buildItems(request) +
      this.buildAssociatedVouchers(request) +
      "</ar:Cmp>"
    );
  }

  private buildShippingPermits(request: ExportCaeRequest): string {
    if (request.shippingPermits.length === 0) {
      return "<ar:Permiso_existente>N</ar:Permiso_existente>";
    }
    return (
      "<ar:Permiso_existente>S</ar:Permiso_existente>" +
      "<ar:Permisos>" +
      request.shippingPermits
        .map(
          (permit) =>
            "<ar:Permiso>" +
            `<ar:Id_permiso>${escapeXml(permit.permitId)}</ar:Id_permiso>` +
            `<ar:Dst_merc>${permit.destinationCountryId}</ar:Dst_merc>` +
            "</ar:Permiso>",
        )
        .join("") +
      "</ar:Permisos>"
    );
  }

  private buildItems(request: ExportCaeRequest): string {
    return (
      "<ar:Items>" +
      request.items
        .map(
          (item) =>
            "<ar:Item>" +
            optionalElement("Pro_codigo", item.code) +
            `<ar:Pro_ds>${escapeXml(item.description)}</ar:Pro_ds>` +
            `<ar:Pro_qty>${item.quantity}</ar:Pro_qty>` +
            `<ar:Pro_umed>${item.unitOfMeasureId}</ar:Pro_umed>` +
            `<ar:Pro_precio_uni>${item.unitPrice}</ar:Pro_precio_uni>` +
            `<ar:Pro_bonificacion>${num(item.discount)}</ar:Pro_bonificacion>` +
            `<ar:Pro_total_item>${num(exportItemTotal(item))}</ar:Pro_total_item>` +
            "</ar:Item>",
        )
        .join("") +
      "</ar:Items>"
    );
  }

  private buildAssociatedVouchers(request: ExportCaeRequest): string {
    if (request.associatedVouchers.length === 0) return "";
    return (
      "<ar:Cmps_asoc>" +
      request.associatedVouchers
        .map(
          (voucher) =>
            "<ar:Cmp_asoc>" +
            `<ar:Cbte_tipo>${voucher.type}</ar:Cbte_tipo>` +
            `<ar:Cbte_punto_vta>${voucher.salesPoint}</ar:Cbte_punto_vta>` +
            `<ar:Cbte_nro>${voucher.number}</ar:Cbte_nro>` +
            "</ar:Cmp_asoc>",
        )
        .join("") +
      "</ar:Cmps_asoc>"
    );
  }

  parseAuthorizeResponse(xml: ParsedXml): ExportCaeResult {
    this.assertNoError(xml);

    const result = xml.optional("Resultado", "");
    if (result !== "" && result !== APPROVED_RESULT) {
      const observations = xml.observations();
      throw new WsfexRejectionError(
        observations.map(({ code }) => code),
        observations.map(({ code, message }) => `(${code}) ${message}`),
      );
    }

    const cae = xml.required("Cae");
    const caeVto = xml.required("Fch_venc_Cae");
    const reprocessed = xml.optional("Reproceso", "") === REPROCESSED_FLAG;
    const observations = xml.observations();

    if (reprocessed) {
      this.logger.warn(`ARCA devolvió un comprobante de exportación ya emitido (reproceso), CAE ${cae}.`);
    }
    if (observations.length > 0) {
      this.logger.warn(
        `Exportación autorizada con observaciones: ${observations
          .map(({ code, message }) => `(${code}) ${message}`)
          .join(" · ")}`,
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
