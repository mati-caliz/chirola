import { TaxTreatment } from "@chirola/shared";
import { renderQrPng, recipientFromQr } from "./qr-image.util";
import {
  fiscalTransparencyLines,
  issuerDetailLines,
  renderVoucherPdf,
  type VoucherPdfData,
} from "./pdf.util";
import { buildQrUrl } from "./qr.util";

const qrUrl = buildQrUrl({
  date: new Date(2026, 6, 12),
  issuerCuit: "20111111112",
  salesPoint: 1,
  voucherType: 8,
  number: 5,
  totalAmount: 121,
  currency: "PES",
  exchangeRate: 1,
  recipientDocType: 80,
  recipientDocNumber: "30707153745",
  cae: "75123456789012",
});

describe("qr-image util", () => {
  it("renderiza el QR como PNG válido (magic bytes)", async () => {
    const png = await renderQrPng(qrUrl);
    expect(png.length).toBeGreaterThan(100);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("extrae el receptor del payload del QR", () => {
    expect(recipientFromQr(qrUrl)).toEqual({ docType: 80, docNumber: "30707153745" });
  });

  it("devuelve null si la URL no tiene payload", () => {
    expect(recipientFromQr("https://afip.gob.ar/fe/qr/")).toBeNull();
    expect(recipientFromQr("basura")).toBeNull();
  });
});

describe("pdf util", () => {
  function data(overrides: Partial<VoucherPdfData> = {}): VoucherPdfData {
    return {
      issuer: {
        legalName: "Acme SA",
        commercialAddress: null,
        cuit: "20111111112",
        ivaCondition: "RESPONSABLE_INSCRIPTO",
      },
      recipient: { docType: 80, docNumber: "30707153745" },
      voucherType: 8,
      salesPoint: 1,
      number: 5,
      date: new Date(2026, 6, 12),
      currency: "PES",
      netAmount: 100,
      ivaAmount: 21,
      exemptAmount: 0,
      untaxedAmount: 0,
      totalAmount: 121,
      tributes: [],
      cae: "75123456789012",
      caeExpiration: new Date(2026, 6, 22),
      items: [
        {
          description: "Servicio de consultoría",
          quantity: 1,
          unitPrice: 121,
          ivaRate: 21,
          taxTreatment: TaxTreatment.TAXED,
          subtotal: 121,
        },
      ],
      associatedVouchers: [{ type: 6, salesPoint: 1, number: 42 }],
      servicePeriod: null,
      paymentDueDate: null,
      fiscalTransparency: null,
      qrPng: Buffer.alloc(0),
      ...overrides,
    };
  }

  it("genera un PDF válido (magic %PDF)", async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderVoucherPdf(data({ qrPng }));
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("funciona sin receptor (consumidor final) y sin asociados", async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderVoucherPdf(data({ qrPng, recipient: null, associatedVouchers: [] }));
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renderiza exentos, no gravados y tributos en los totales", async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderVoucherPdf(
      data({
        qrPng,
        exemptAmount: 500,
        untaxedAmount: 300,
        totalAmount: 951,
        tributes: [{ description: "Percepción IIBB CABA", amount: 30 }],
        items: [
          {
            description: "Libro",
            quantity: 1,
            unitPrice: 500,
            ivaRate: 0,
            taxTreatment: TaxTreatment.EXEMPT,
            subtotal: 500,
          },
        ],
      }),
    );
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renderiza el período facturado en comprobantes de servicios", async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderVoucherPdf(
      data({
        qrPng,
        servicePeriod: { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) },
        paymentDueDate: new Date(2026, 7, 10),
      }),
    );
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renderiza el domicilio comercial y la leyenda de transparencia fiscal", async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderVoucherPdf(
      data({
        qrPng,
        voucherType: 6,
        issuer: {
          legalName: "Acme SA",
          commercialAddress: "Av. Corrientes 1234, CABA",
          cuit: "20111111112",
          ivaCondition: "RESPONSABLE_INSCRIPTO",
        },
        fiscalTransparency: { containedIva: 21, otherNationalIndirectTaxes: 0 },
      }),
    );
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});

describe("issuerDetailLines", () => {
  const issuer = {
    legalName: "Acme SA",
    cuit: "20111111112",
    ivaCondition: "RESPONSABLE_INSCRIPTO",
  };

  it("pone el domicilio comercial debajo de la razón social cuando existe", () => {
    expect(issuerDetailLines({ ...issuer, commercialAddress: "Av. Corrientes 1234, CABA" })).toEqual([
      "Domicilio comercial: Av. Corrientes 1234, CABA",
      "CUIT: 20111111112",
      "Condición IVA: RESPONSABLE_INSCRIPTO",
    ]);
  });

  it("omite el domicilio comercial cuando el emisor no lo cargó", () => {
    expect(issuerDetailLines({ ...issuer, commercialAddress: null })).toEqual([
      "CUIT: 20111111112",
      "Condición IVA: RESPONSABLE_INSCRIPTO",
    ]);
  });
});

describe("fiscalTransparencyLines", () => {
  it("arma la leyenda de la Ley 27.743 con los importes en formato argentino", () => {
    expect(fiscalTransparencyLines({ containedIva: 1234.5, otherNationalIndirectTaxes: 0 })).toEqual([
      "Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)",
      "IVA Contenido: $ 1.234,50",
      "Otros Impuestos Nacionales Indirectos: $ 0,00",
    ]);
  });
});
