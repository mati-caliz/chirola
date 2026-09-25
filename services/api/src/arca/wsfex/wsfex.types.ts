import type { ExportItem, ShippingPermit } from "@chirola/shared";
import type { ArcaObservation, AuthContext } from "../wsfe/wsfe.types";

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
    taxId?: string | undefined;
  };
  currency: string;
  exchangeRate: number;
  language: number;
  incoterm?: string | undefined;
  incotermDescription?: string | undefined;
  paymentMethod?: string | undefined;
  commercialNotes?: string | undefined;
  notes?: string | undefined;
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
