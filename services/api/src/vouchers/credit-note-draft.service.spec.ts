import { UnprocessableEntityException } from "@nestjs/common";
import { VoucherConcept, VoucherStatus, VoucherType } from "@chirola/shared";
import { buildCreditNoteDraft, type CreditNoteSourceVoucher } from "./credit-note-draft.service";

const TODAY = new Date(2026, 8, 22);

function sourceVoucher(overrides: Partial<CreditNoteSourceVoucher> = {}): CreditNoteSourceVoucher {
  return {
    issuerId: "issuer-1",
    voucherType: VoucherType.FACTURA_A,
    status: VoucherStatus.APPROVED,
    concept: VoucherConcept.PRODUCTS,
    number: 42,
    voucherDate: new Date(2026, 8, 10),
    serviceFrom: null,
    serviceTo: null,
    currency: "PES",
    exchangeRate: 1,
    qrData: null,
    recipientDocType: 80,
    recipientDocNumber: "20111111112",
    recipientName: "Cliente SA",
    salesPoint: { number: 3 },
    client: null,
    issuer: { cuit: "20435734678" },
    items: [{ description: "Servicio", quantity: 2, unitPrice: 605, ivaRate: 21, taxTreatment: "TAXED" }],
    ...overrides,
  };
}

describe("buildCreditNoteDraft", () => {
  it("arma la nota de crédito de la misma letra, asociada al comprobante original", () => {
    const draft = buildCreditNoteDraft(sourceVoucher(), TODAY);

    expect(draft.voucherType).toBe(VoucherType.NOTA_CREDITO_A);
    expect(draft.salesPoint).toBe(3);
    expect(draft.recipient).toEqual({ docType: 80, docNumber: "20111111112", legalName: "Cliente SA" });
    expect(draft.associatedVouchers).toEqual([
      { type: VoucherType.FACTURA_A, salesPoint: 3, number: 42, cuit: "20435734678", date: "20260910" },
    ]);
    expect(draft.items).toEqual([
      { description: "Servicio", quantity: 2, unitPrice: 605, ivaRate: 21, taxTreatment: "TAXED" },
    ]);
    expect(draft.paymentDueDate).toBeUndefined();
  });

  it("en servicios copia el período y pone hoy como vencimiento de pago", () => {
    const draft = buildCreditNoteDraft(
      sourceVoucher({
        concept: VoucherConcept.SERVICES,
        serviceFrom: new Date(2026, 7, 1),
        serviceTo: new Date(2026, 7, 31),
      }),
      TODAY,
    );

    expect(draft.servicePeriod).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(draft.paymentDueDate).toBe("2026-09-22");
  });

  it("rechaza anular una nota de crédito", () => {
    expect(() =>
      buildCreditNoteDraft(sourceVoucher({ voucherType: VoucherType.NOTA_CREDITO_A }), TODAY),
    ).toThrow(UnprocessableEntityException);
  });

  it("rechaza un comprobante que ARCA no autorizó", () => {
    expect(() => buildCreditNoteDraft(sourceVoucher({ status: VoucherStatus.REJECTED }), TODAY)).toThrow(
      UnprocessableEntityException,
    );
  });
});
