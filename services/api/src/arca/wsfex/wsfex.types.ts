import type { ExportItem, ShippingPermit } from '@chirola/shared';
import type { ArcaObservation, AuthContext } from '../wsfe/wsfe.types';

export interface ExportCaeRequest {
  requestId: number;
  salesPoint: number;
  voucherType: number;
  number: number;
  date: Date;
  exportType: number;
  destinationCountryId: number;
  countryTaxId: string;
  client: {
    legalName: string;
    address: string;
    taxId?: string;
  };
  currency: string;
  exchangeRate: number;
  language: number;
  incoterm?: string;
  incotermDescription?: string;
  paymentMethod?: string;
  commercialNotes?: string;
  notes?: string;
  shippingPermits: ShippingPermit[];
  items: ExportItem[];
  totalAmount: number;
  associatedVouchers: {
    type: number;
    salesPoint: number;
    number: number;
  }[];
}

export interface ExportCaeResult {
  cae: string;
  caeVto: Date;
  observations: ArcaObservation[];
  reprocessed: boolean;
}

export type { AuthContext };
