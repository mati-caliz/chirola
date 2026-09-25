import { useState, type Dispatch, type SetStateAction } from "react";
import {
  DocumentType,
  LOCAL_CURRENCY,
  LOCAL_EXCHANGE_RATE,
  TransmissionType,
  VoucherConcept,
  VoucherType,
  type IssueVoucher,
  type ServicePeriod,
  type TransmissionTypeName,
  type VoucherConceptType,
} from "@chirola/shared";
import {
  currentMonthPeriod,
  newItem,
  todayIso,
  toItemForm,
  type ItemForm,
  type TributeForm,
} from "./form-model";

const DEFAULT_SALES_POINT = "1";
const CONSUMIDOR_FINAL_DOC_NUMBER = "0";

export interface VoucherFormValues {
  voucherType: number;
  salesPoint: string;
  concept: VoucherConceptType;
  servicePeriod: ServicePeriod;
  paymentDueDate: string;
  transmissionType: TransmissionTypeName;
  docType: number;
  docNumber: string;
  legalName: string;
  recipientIvaConditionId: number | null;
  currency: string;
  exchangeRate: string;
  items: ItemForm[];
  tributes: TributeForm[];
}

export interface VoucherFormSetters {
  setVoucherType: Dispatch<SetStateAction<number>>;
  setSalesPoint: Dispatch<SetStateAction<string>>;
  setConcept: Dispatch<SetStateAction<VoucherConceptType>>;
  setServicePeriod: Dispatch<SetStateAction<ServicePeriod>>;
  setPaymentDueDate: Dispatch<SetStateAction<string>>;
  setTransmissionType: Dispatch<SetStateAction<TransmissionTypeName>>;
  setDocType: Dispatch<SetStateAction<number>>;
  setDocNumber: Dispatch<SetStateAction<string>>;
  setLegalName: Dispatch<SetStateAction<string>>;
  setRecipientIvaConditionId: Dispatch<SetStateAction<number | null>>;
  setCurrency: Dispatch<SetStateAction<string>>;
  setExchangeRate: Dispatch<SetStateAction<string>>;
  setItems: Dispatch<SetStateAction<ItemForm[]>>;
  setTributes: Dispatch<SetStateAction<TributeForm[]>>;
}

export interface VoucherFormState {
  values: VoucherFormValues;
  setters: VoucherFormSetters;
}

type InitialValues = Omit<VoucherFormValues, "transmissionType" | "recipientIvaConditionId" | "tributes">;

function blankInitialValues(): InitialValues {
  return {
    voucherType: VoucherType.FACTURA_B,
    salesPoint: DEFAULT_SALES_POINT,
    concept: VoucherConcept.PRODUCTS,
    servicePeriod: currentMonthPeriod(),
    paymentDueDate: todayIso(),
    docType: DocumentType.CONSUMIDOR_FINAL,
    docNumber: CONSUMIDOR_FINAL_DOC_NUMBER,
    legalName: "",
    currency: LOCAL_CURRENCY,
    exchangeRate: String(LOCAL_EXCHANGE_RATE),
    items: [newItem()],
  };
}

function initialValuesFromDraft(draft: IssueVoucher | null): InitialValues {
  if (draft === null) return blankInitialValues();
  return {
    voucherType: draft.voucherType,
    salesPoint: String(draft.salesPoint),
    concept: draft.concept,
    servicePeriod: draft.servicePeriod ?? currentMonthPeriod(),
    paymentDueDate: draft.paymentDueDate ?? todayIso(),
    docType: draft.recipient.docType,
    docNumber: draft.recipient.docNumber,
    legalName: draft.recipient.legalName ?? "",
    currency: draft.currency,
    exchangeRate: String(draft.exchangeRate),
    items: draft.items.map(toItemForm),
  };
}

export function useVoucherFormState(draft: IssueVoucher | null): VoucherFormState {
  const [initial] = useState(() => initialValuesFromDraft(draft));
  const [voucherType, setVoucherType] = useState<number>(initial.voucherType);
  const [salesPoint, setSalesPoint] = useState(initial.salesPoint);
  const [concept, setConcept] = useState<VoucherConceptType>(initial.concept);
  const [servicePeriod, setServicePeriod] = useState<ServicePeriod>(initial.servicePeriod);
  const [paymentDueDate, setPaymentDueDate] = useState(initial.paymentDueDate);
  const [transmissionType, setTransmissionType] = useState<TransmissionTypeName>(
    TransmissionType.OPEN_CIRCULATION,
  );
  const [docType, setDocType] = useState<number>(initial.docType);
  const [docNumber, setDocNumber] = useState(initial.docNumber);
  const [legalName, setLegalName] = useState(initial.legalName);
  const [recipientIvaConditionId, setRecipientIvaConditionId] = useState<number | null>(null);
  const [currency, setCurrency] = useState(initial.currency);
  const [exchangeRate, setExchangeRate] = useState(initial.exchangeRate);
  const [items, setItems] = useState<ItemForm[]>(initial.items);
  const [tributes, setTributes] = useState<TributeForm[]>([]);

  return {
    values: {
      voucherType,
      salesPoint,
      concept,
      servicePeriod,
      paymentDueDate,
      transmissionType,
      docType,
      docNumber,
      legalName,
      recipientIvaConditionId,
      currency,
      exchangeRate,
      items,
      tributes,
    },
    setters: {
      setVoucherType,
      setSalesPoint,
      setConcept,
      setServicePeriod,
      setPaymentDueDate,
      setTransmissionType,
      setDocType,
      setDocNumber,
      setLegalName,
      setRecipientIvaConditionId,
      setCurrency,
      setExchangeRate,
      setItems,
      setTributes,
    },
  };
}
