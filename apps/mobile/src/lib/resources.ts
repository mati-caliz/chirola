import type {
  UpdateClient,
  CreateClient,
  CreateIssuer,
  IssueVoucher,
  TaxpayerInfo,
} from '@chirola/shared';
import { apiFetch } from './api';

export interface Issuer {
  id: string;
  cuit: string;
  legalName: string;
  ivaCondition: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
  certificate: { alias: string | null; validUntil: string | null } | null;
}

export interface Client {
  id: string;
  issuerId: string;
  docType: number;
  docNumber: string;
  legalName: string | null;
  ivaCondition: string | null;
  email: string | null;
}

export interface IssuedVoucher {
  id: string;
  voucherType: number;
  salesPoint: number;
  number: number;
  cae: string;
  caeExpiration: string;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  qrData: string;
}

export interface VoucherItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  ivaRate: string;
  subtotal: string;
}

export interface VoucherDetail {
  id: string;
  voucherType: number;
  number: number;
  voucherDate: string;
  concept: number;
  netAmount: string;
  ivaAmount: string;
  totalAmount: string;
  currency: string;
  status: string;
  cae: string | null;
  caeExpiration: string | null;
  qrData: string | null;
  items: VoucherItem[];
  salesPoint: { number: number };
  issuer: { legalName: string; cuit: string };
  client: Client | null;
}

export const listIssuers = () => apiFetch<Issuer[]>('/issuers');

export const createIssuer = (body: CreateIssuer) =>
  apiFetch<Issuer>('/issuers', { method: 'POST', body });

export const generateCsr = (issuerId: string, alias?: string) =>
  apiFetch<{ csrPem: string }>(`/issuers/${issuerId}/csr`, {
    method: 'POST',
    body: alias ? { alias } : {},
  });

export const matchCertificate = (issuerId: string, certPem: string) =>
  apiFetch<{ ok: true }>(`/issuers/${issuerId}/certificate`, {
    method: 'PUT',
    body: { certPem },
  });

export const listClients = (issuerId: string) =>
  apiFetch<Client[]>(`/issuers/${issuerId}/clients`);

export const createClient = (issuerId: string, body: CreateClient) =>
  apiFetch<Client>(`/issuers/${issuerId}/clients`, { method: 'POST', body });

export const updateClient = (
  issuerId: string,
  id: string,
  body: UpdateClient,
) =>
  apiFetch<Client>(`/issuers/${issuerId}/clients/${id}`, {
    method: 'PATCH',
    body,
  });

export interface Currency {
  id: string;
  description: string;
}

export interface ExchangeRate {
  currencyId: string;
  rate: number;
  date: string;
}

export const listCurrencies = (issuerId: string) =>
  apiFetch<Currency[]>(`/issuers/${issuerId}/currencies`);

export const getExchangeRate = (issuerId: string, currencyId: string) =>
  apiFetch<ExchangeRate>(`/issuers/${issuerId}/exchange-rate/${currencyId}`);

export const lookupTaxpayer = (issuerId: string, cuit: string) =>
  apiFetch<TaxpayerInfo>(`/issuers/${issuerId}/taxpayers/${cuit}`);

export const issueVoucher = (body: IssueVoucher) =>
  apiFetch<IssuedVoucher>('/vouchers', { method: 'POST', body });

export const getVoucher = (id: string) =>
  apiFetch<VoucherDetail>(`/vouchers/${id}`);
