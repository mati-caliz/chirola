import { hasText, type AssociatedVoucher } from "@chirola/shared";
import { escapeXml } from "../arca-soap.util";
import { toArcaDate } from "../arca-date";
import type { ArcaIvaRate, ArcaOptional, ArcaTribute, CaeRequest } from "./wsfe.types";

const AMOUNT_DECIMALS = 2;

const amount = (value: number): string => value.toFixed(AMOUNT_DECIMALS);

function isoToArcaDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function optionalTag(tag: string, value: string | undefined): string {
  return hasText(value) ? `<ar:${tag}>${value}</ar:${tag}>` : "";
}

export function buildCaeHeader(request: CaeRequest): string {
  return (
    "<ar:FeCabReq>" +
    "<ar:CantReg>1</ar:CantReg>" +
    `<ar:PtoVta>${request.salesPoint}</ar:PtoVta>` +
    `<ar:CbteTipo>${request.voucherType}</ar:CbteTipo>` +
    "</ar:FeCabReq>"
  );
}

function associatedVoucherXml(voucher: AssociatedVoucher): string {
  return (
    "<ar:CbteAsoc>" +
    `<ar:Tipo>${voucher.type}</ar:Tipo>` +
    `<ar:PtoVta>${voucher.salesPoint}</ar:PtoVta>` +
    `<ar:Nro>${voucher.number}</ar:Nro>` +
    optionalTag("Cuit", voucher.cuit) +
    optionalTag("CbteFch", voucher.date) +
    "</ar:CbteAsoc>"
  );
}

function buildAssociatedVouchers(request: CaeRequest): string {
  const associated = request.associatedVouchers ?? [];
  if (associated.length === 0) return "";
  return "<ar:CbtesAsoc>" + associated.map(associatedVoucherXml).join("") + "</ar:CbtesAsoc>";
}

function tributeXml(tribute: ArcaTribute): string {
  return (
    "<ar:Tributo>" +
    `<ar:Id>${tribute.id}</ar:Id>` +
    `<ar:Desc>${escapeXml(tribute.description)}</ar:Desc>` +
    `<ar:BaseImp>${amount(tribute.taxableBase)}</ar:BaseImp>` +
    `<ar:Alic>${amount(tribute.rate)}</ar:Alic>` +
    `<ar:Importe>${amount(tribute.amount)}</ar:Importe>` +
    "</ar:Tributo>"
  );
}

function buildTributes(request: CaeRequest): string {
  const { tributes } = request.amounts;
  if (tributes.length === 0) return "";
  return "<ar:Tributos>" + tributes.map(tributeXml).join("") + "</ar:Tributos>";
}

function buildServicePeriod(request: CaeRequest): string {
  const { servicePeriod, paymentDueDate } = request;
  const period =
    servicePeriod === undefined
      ? ""
      : `<ar:FchServDesde>${isoToArcaDate(servicePeriod.from)}</ar:FchServDesde>` +
        `<ar:FchServHasta>${isoToArcaDate(servicePeriod.to)}</ar:FchServHasta>`;
  const dueDate = hasText(paymentDueDate)
    ? `<ar:FchVtoPago>${isoToArcaDate(paymentDueDate)}</ar:FchVtoPago>`
    : "";
  return period + dueDate;
}

function optionalXml(optional: ArcaOptional): string {
  return (
    "<ar:Opcional>" +
    `<ar:Id>${optional.id}</ar:Id>` +
    `<ar:Valor>${escapeXml(optional.value)}</ar:Valor>` +
    "</ar:Opcional>"
  );
}

function buildOptionals(request: CaeRequest): string {
  const optionals = request.optionals ?? [];
  if (optionals.length === 0) return "";
  return "<ar:Opcionales>" + optionals.map(optionalXml).join("") + "</ar:Opcionales>";
}

function ivaRateXml(rate: ArcaIvaRate): string {
  return (
    "<ar:AlicIva>" +
    `<ar:Id>${rate.id}</ar:Id>` +
    `<ar:BaseImp>${amount(rate.taxableBase)}</ar:BaseImp>` +
    `<ar:Importe>${amount(rate.amount)}</ar:Importe>` +
    "</ar:AlicIva>"
  );
}

function buildIvaRates(request: CaeRequest): string {
  const { rates } = request.amounts;
  if (rates.length === 0) return "";
  return "<ar:Iva>" + rates.map(ivaRateXml).join("") + "</ar:Iva>";
}

export function buildCaeDetail(request: CaeRequest): string {
  const { amounts } = request;
  return (
    "<ar:FeDetReq>" +
    "<ar:FECAEDetRequest>" +
    `<ar:Concepto>${request.concept}</ar:Concepto>` +
    `<ar:DocTipo>${request.recipient.docType}</ar:DocTipo>` +
    `<ar:DocNro>${request.recipient.docNumber.replace(/-/g, "")}</ar:DocNro>` +
    `<ar:CbteDesde>${request.number}</ar:CbteDesde>` +
    `<ar:CbteHasta>${request.number}</ar:CbteHasta>` +
    `<ar:CbteFch>${toArcaDate(request.date)}</ar:CbteFch>` +
    `<ar:ImpTotal>${amount(amounts.totalAmount)}</ar:ImpTotal>` +
    `<ar:ImpTotConc>${amount(amounts.untaxedAmount)}</ar:ImpTotConc>` +
    `<ar:ImpNeto>${amount(amounts.netAmount)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>${amount(amounts.exemptAmount)}</ar:ImpOpEx>` +
    `<ar:ImpTrib>${amount(amounts.tributeAmount)}</ar:ImpTrib>` +
    `<ar:ImpIVA>${amount(amounts.ivaAmount)}</ar:ImpIVA>` +
    buildServicePeriod(request) +
    `<ar:MonId>${request.currency}</ar:MonId>` +
    `<ar:MonCotiz>${request.exchangeRate}</ar:MonCotiz>` +
    `<ar:CondicionIVAReceptorId>${request.recipient.ivaConditionId}</ar:CondicionIVAReceptorId>` +
    buildAssociatedVouchers(request) +
    buildTributes(request) +
    buildIvaRates(request) +
    buildOptionals(request) +
    "</ar:FECAEDetRequest>" +
    "</ar:FeDetReq>"
  );
}
