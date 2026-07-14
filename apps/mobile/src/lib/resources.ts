import type {
  UpdateClient,
  CreateClient,
  CreateIssuer,
  IssueVoucher,
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

export interface VoucherSummary {
  id: string;
  voucherType: number;
  number: number;
  voucherDate: string;
  status: string;
  cae: string | null;
  totalAmount: string;
  salesPoint: { number: number };
  client: { legalName: string | null; docNumber: string } | null;
}

export const listVouchers = (issuerId: string) =>
  apiFetch<VoucherSummary[]>(`/issuers/${issuerId}/vouchers`);

export interface IvaRateBreakdown {
  rate: number;
  debit: number;
  credit: number;
  balance: number;
}

export interface IvaPosition {
  year: number;
  month: number;
  breakdown: IvaRateBreakdown[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export type VencimientoStatus = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';

export interface Vencimiento {
  type: string;
  label: string;
  dueDate: string;
  status: VencimientoStatus;
}

export const getIvaPosition = (issuerId: string, year: number, month: number) =>
  apiFetch<IvaPosition>(`/fiscal/iva-position?issuerId=${issuerId}&year=${year}&month=${month}`);

export const getVencimientos = (issuerId: string) =>
  apiFetch<Vencimiento[]>(`/fiscal/vencimientos?issuerId=${issuerId}`);

export interface SalesPoint {
  id: string;
  number: number;
  description: string | null;
}

export const listSalesPoints = (issuerId: string) =>
  apiFetch<SalesPoint[]>(`/issuers/${issuerId}/sales-points`);

export const syncSalesPoints = (issuerId: string) =>
  apiFetch<SalesPoint[]>(`/issuers/${issuerId}/sales-points/sync`, { method: 'POST' });

export const updateSalesPoint = (issuerId: string, number: number, description: string) =>
  apiFetch<SalesPoint>(`/issuers/${issuerId}/sales-points/${number}`, {
    method: 'PATCH',
    body: { description },
  });

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

export const issueVoucher = (body: IssueVoucher) =>
  apiFetch<IssuedVoucher>('/vouchers', { method: 'POST', body });

export const getVoucher = (id: string) =>
  apiFetch<VoucherDetail>(`/vouchers/${id}`);
