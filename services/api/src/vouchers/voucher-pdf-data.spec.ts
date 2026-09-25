import { Prisma } from "@prisma/client";
import { TaxTreatment, VoucherType } from "@chirola/shared";
import { buildVoucherDetail, FIXTURE_VOUCHER_QR } from "./voucher-detail.fixture";
import { buildVoucherPdfData, type AuthorizedVoucher } from "./voucher-pdf-data";
import type { VoucherDetail } from "./voucher-tables";

const QR_PNG = Buffer.from("png");

function authorized(overrides: Partial<VoucherDetail> = {}): AuthorizedVoucher {
  const voucher = buildVoucherDetail(overrides);
  return { ...voucher, qrData: FIXTURE_VOUCHER_QR, cae: "75123456789012" };
}

describe("buildVoucherPdfData", () => {
  it("maps the stored voucher, its issuer and the QR recipient into the PDF data", () => {
    const data = buildVoucherPdfData(authorized(), QR_PNG);

    expect(data).toEqual(
      expect.objectContaining({
        issuer: {
          legalName: "ACME SRL",
          commercialAddress: "Av. Siempreviva 742",
          cuit: "20111111112",
          ivaCondition: "RESPONSABLE_INSCRIPTO",
        },
        recipient: { docType: 80, docNumber: "30707153745" },
        voucherType: VoucherType.FACTURA_A,
        salesPoint: 3,
        number: 42,
        netAmount: 1000,
        ivaAmount: 210,
        exemptAmount: 0,
        untaxedAmount: 0,
        totalAmount: 1210,
        cae: "75123456789012",
        tributes: [],
        associatedVouchers: [],
        servicePeriod: null,
        paymentDueDate: null,
        fiscalTransparency: null,
        qrPng: QR_PNG,
      }),
    );
    expect(data.items).toEqual([
      {
        description: "Consultoría",
        quantity: 2,
        unitPrice: 500,
        ivaRate: 21,
        taxTreatment: TaxTreatment.TAXED,
        subtotal: 1000,
      },
    ]);
  });

  it("falls back to the voucher date when the CAE expiration is missing", () => {
    const voucherDate = new Date(2026, 8, 1);

    expect(buildVoucherPdfData(authorized({ caeExpiration: null, voucherDate }), QR_PNG).caeExpiration).toBe(
      voucherDate,
    );
  });

  it("includes the service period only when both ends are stored", () => {
    const from = new Date(2026, 7, 1);
    const to = new Date(2026, 7, 31);

    expect(
      buildVoucherPdfData(authorized({ serviceFrom: from, serviceTo: to }), QR_PNG).servicePeriod,
    ).toEqual({
      from,
      to,
    });
    expect(buildVoucherPdfData(authorized({ serviceFrom: from }), QR_PNG).servicePeriod).toBeNull();
    expect(buildVoucherPdfData(authorized({ serviceTo: to }), QR_PNG).servicePeriod).toBeNull();
  });

  it("exposes stored tributes without their ARCA id", () => {
    const tributes = [{ id: 99, description: "Percepción IIBB", amount: 30 }];

    expect(buildVoucherPdfData(authorized({ tributes }), QR_PNG).tributes).toEqual([
      { description: "Percepción IIBB", amount: 30 },
    ]);
  });

  it("ignores tributes and associated vouchers stored with an unexpected shape", () => {
    const data = buildVoucherPdfData(
      authorized({ tributes: { description: "roto" }, associatedVouchers: [{ type: "A" }] }),
      QR_PNG,
    );

    expect(data.tributes).toEqual([]);
    expect(data.associatedVouchers).toEqual([]);
  });

  it("keeps valid associated vouchers", () => {
    const associatedVouchers = [{ type: VoucherType.FACTURA_A, salesPoint: 3, number: 41 }];

    expect(buildVoucherPdfData(authorized({ associatedVouchers }), QR_PNG).associatedVouchers).toEqual(
      associatedVouchers,
    );
  });

  it("defaults an unknown stored tax treatment to taxed", () => {
    const [item] = buildVoucherDetail().items;
    const odd = item === undefined ? [] : [{ ...item, taxTreatment: "SOMETHING_ELSE" }];

    expect(buildVoucherPdfData(authorized({ items: odd }), QR_PNG).items[0]?.taxTreatment).toBe(
      TaxTreatment.TAXED,
    );
  });

  it("computes the fiscal transparency notice for consumer invoices", () => {
    const data = buildVoucherPdfData(
      authorized({
        voucherType: VoucherType.FACTURA_B,
        ivaAmount: new Prisma.Decimal(210),
      }),
      QR_PNG,
    );

    expect(data.fiscalTransparency).toEqual({ containedIva: 210, otherNationalIndirectTaxes: 0 });
  });

  it("leaves the recipient empty when the QR carries no payload", () => {
    const voucher = { ...authorized(), qrData: "https://www.afip.gob.ar/fe/qr/" };

    expect(buildVoucherPdfData(voucher, QR_PNG).recipient).toBeNull();
  });
});
