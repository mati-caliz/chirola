import { VoucherType } from "@chirola/shared";
import { DraftAmountsService } from "./draft-amounts.service";

describe("DraftAmountsService", () => {
  it("calcula el total de un borrador sin descripciones ni receptor", () => {
    const amounts = new DraftAmountsService().calculate({
      voucherType: VoucherType.FACTURA_A,
      items: [{ quantity: 2, unitPrice: 605, ivaRate: 21, taxTreatment: "TAXED" }],
      tributes: [{ id: 2, taxableBase: 1000, rate: 3 }],
    });

    expect(amounts).toEqual({
      netAmount: 1000,
      ivaAmount: 210,
      exemptAmount: 0,
      untaxedAmount: 0,
      tributeAmount: 30,
      totalAmount: 1240,
    });
  });
});
