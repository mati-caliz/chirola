import {
  arcaHealthSchema,
  arcaParamSchema,
  certificateMatchSchema,
  clientSchema,
  createdIssuerSchema,
  currencySchema,
  draftAmountsResultSchema,
  emissionPlanSchema,
  exchangeRateSchema,
  fiscalAlertsSchema,
  generatedCsrSchema,
  hasText,
  issuedVoucherSchema,
  issuerSchema,
  issueVoucherDraftSchema,
  ivaPositionSchema,
  pendingVoucherSummarySchema,
  salesBookSchema,
  salesPointSchema,
  taxpayerInfoSchema,
  vencimientoSchema,
  voucherDetailSchema,
  voucherSummarySchema,
} from "@chirola/shared";
import type {
  ArcaHealth,
  ArcaParam,
  ArcaParamTypeName,
  CertificateMatch,
  Client,
  CreatedIssuer,
  CreateClient,
  CreateIssuer,
  Currency,
  DraftAmounts,
  DraftAmountsInput,
  EmissionPlan,
  ExchangeRate,
  FiscalAlerts,
  GeneratedCsr,
  IssuedVoucher,
  Issuer,
  IssueVoucher,
  IvaPosition,
  PendingVoucherSummary,
  PushTokenInput,
  SalesBook,
  SalesPoint,
  TaxpayerInfo,
  UpdateClient,
  Vencimiento,
  VoucherDetail,
  VoucherSummary,
} from "@chirola/shared";
import { z } from "zod";
import { apiFetch, apiFetchBase64, apiSend } from "./api";

export const listVouchers = (issuerId: string): Promise<VoucherSummary[]> =>
  apiFetch(`/issuers/${issuerId}/vouchers`, z.array(voucherSummarySchema));

export const getIvaPosition = (issuerId: string, year: number, month: number): Promise<IvaPosition> =>
  apiFetch(`/fiscal/iva-position?issuerId=${issuerId}&year=${year}&month=${month}`, ivaPositionSchema);

export const getVencimientos = (issuerId: string): Promise<Vencimiento[]> =>
  apiFetch(`/fiscal/vencimientos?issuerId=${issuerId}`, z.array(vencimientoSchema));

export const getFiscalAlerts = (issuerId: string): Promise<FiscalAlerts> =>
  apiFetch(`/fiscal/alerts?issuerId=${issuerId}`, fiscalAlertsSchema);

export const listSalesPoints = (issuerId: string): Promise<SalesPoint[]> =>
  apiFetch(`/issuers/${issuerId}/sales-points`, z.array(salesPointSchema));

export const syncSalesPoints = (issuerId: string): Promise<SalesPoint[]> =>
  apiFetch(`/issuers/${issuerId}/sales-points/sync`, z.array(salesPointSchema), { method: "POST" });

export const updateSalesPoint = (
  issuerId: string,
  number: number,
  description: string,
): Promise<SalesPoint> =>
  apiFetch(`/issuers/${issuerId}/sales-points/${number}`, salesPointSchema, {
    method: "PATCH",
    body: { description },
  });

export const listIssuers = (): Promise<Issuer[]> => apiFetch("/issuers", z.array(issuerSchema));

export const createIssuer = (body: CreateIssuer): Promise<CreatedIssuer> =>
  apiFetch("/issuers", createdIssuerSchema, { method: "POST", body });

export const generateCsr = (issuerId: string, alias?: string): Promise<GeneratedCsr> =>
  apiFetch(`/issuers/${issuerId}/csr`, generatedCsrSchema, {
    method: "POST",
    body: hasText(alias) ? { alias } : {},
  });

export const matchCertificate = (issuerId: string, certPem: string): Promise<CertificateMatch> =>
  apiFetch(`/issuers/${issuerId}/certificate`, certificateMatchSchema, {
    method: "PUT",
    body: { certPem },
  });

export const listClients = (issuerId: string): Promise<Client[]> =>
  apiFetch(`/issuers/${issuerId}/clients`, z.array(clientSchema));

export const createClient = (issuerId: string, body: CreateClient): Promise<Client> =>
  apiFetch(`/issuers/${issuerId}/clients`, clientSchema, { method: "POST", body });

export const updateClient = (issuerId: string, id: string, body: UpdateClient): Promise<Client> =>
  apiFetch(`/issuers/${issuerId}/clients/${id}`, clientSchema, {
    method: "PATCH",
    body,
  });

export const listCurrencies = (issuerId: string): Promise<Currency[]> =>
  apiFetch(`/issuers/${issuerId}/currencies`, z.array(currencySchema));

export const getExchangeRate = (issuerId: string, currencyId: string): Promise<ExchangeRate> =>
  apiFetch(`/issuers/${issuerId}/exchange-rate/${currencyId}`, exchangeRateSchema);

export const listArcaParams = (issuerId: string, paramType: ArcaParamTypeName): Promise<ArcaParam[]> =>
  apiFetch(`/issuers/${issuerId}/params/${paramType}`, z.array(arcaParamSchema));

export const lookupTaxpayer = (issuerId: string, cuit: string): Promise<TaxpayerInfo> =>
  apiFetch(`/issuers/${issuerId}/taxpayers/${cuit}`, taxpayerInfoSchema);

export const issueVoucher = (body: IssueVoucher): Promise<IssuedVoucher> =>
  apiFetch("/vouchers", issuedVoucherSchema, { method: "POST", body });

export const getVoucher = (id: string): Promise<VoucherDetail> =>
  apiFetch(`/vouchers/${id}`, voucherDetailSchema);

export const dryRunVoucher = (body: IssueVoucher): Promise<EmissionPlan> =>
  apiFetch("/vouchers/dry-run", emissionPlanSchema, { method: "POST", body });

export const getCreditNoteDraft = (voucherId: string): Promise<IssueVoucher> =>
  apiFetch(`/vouchers/${voucherId}/credit-note-draft`, issueVoucherDraftSchema);

export const listPendingVouchers = (issuerId: string): Promise<PendingVoucherSummary[]> =>
  apiFetch(`/issuers/${issuerId}/pending-vouchers`, z.array(pendingVoucherSummarySchema));

export const retryPendingVoucher = (issuerId: string, id: string): Promise<void> =>
  apiSend(`/issuers/${issuerId}/pending-vouchers/${id}/retry`, { method: "POST" });

export const discardPendingVoucher = (issuerId: string, id: string): Promise<void> =>
  apiSend(`/issuers/${issuerId}/pending-vouchers/${id}`, { method: "DELETE" });

const periodQuery = (issuerId: string, year: number, month: number): string =>
  `issuerId=${issuerId}&year=${year}&month=${month}`;

export const getSalesBook = (issuerId: string, year: number, month: number): Promise<SalesBook> =>
  apiFetch(`/fiscal/sales-book?${periodQuery(issuerId, year, month)}`, salesBookSchema);

export const downloadSalesBookCsv = (issuerId: string, year: number, month: number): Promise<string> =>
  apiFetchBase64(`/fiscal/sales-book/csv?${periodQuery(issuerId, year, month)}`);

export const getArcaHealth = (issuerId: string): Promise<ArcaHealth> =>
  apiFetch(`/issuers/${issuerId}/arca-health`, arcaHealthSchema);

export const registerPushToken = (body: PushTokenInput): Promise<void> =>
  apiSend("/push-tokens", { method: "POST", body });

export const removePushToken = (token: string): Promise<void> =>
  apiSend("/push-tokens", { method: "DELETE", body: { token } });

export const calculateDraftAmounts = (body: DraftAmountsInput): Promise<DraftAmounts> =>
  apiFetch("/vouchers/amounts", draftAmountsResultSchema, { method: "POST", body });
