import { renderQrPng, recipientFromQr } from './qr-image.util';
import { renderVoucherPdf, type VoucherPdfData } from './pdf.util';
import { buildQrUrl } from './qr.util';

const qrUrl = buildQrUrl({
  date: new Date(2026, 6, 12),
  issuerCuit: '20111111112',
  salesPoint: 1,
  voucherType: 8,
  number: 5,
  totalAmount: 121,
  currency: 'PES',
  exchangeRate: 1,
  recipientDocType: 80,
  recipientDocNumber: '30707153745',
  cae: '75123456789012',
});

describe('qr-image util', () => {
  it('renderiza el QR como PNG válido (magic bytes)', async () => {
    const png = await renderQrPng(qrUrl);
    expect(png.length).toBeGreaterThan(100);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it('extrae el receptor del payload del QR', () => {
    expect(recipientFromQr(qrUrl)).toEqual({ docType: 80, docNumber: '30707153745' });
  });

  it('devuelve null si la URL no tiene payload', () => {
    expect(recipientFromQr('https://afip.gob.ar/fe/qr/')).toBeNull();
    expect(recipientFromQr('basura')).toBeNull();
  });
});

describe('pdf util', () => {
  function data(overrides: Partial<VoucherPdfData> = {}): VoucherPdfData {
    return {
      issuer: { legalName: 'Acme SA', cuit: '20111111112', ivaCondition: 'RESPONSABLE_INSCRIPTO' },
      recipient: { docType: 80, docNumber: '30707153745' },
      voucherType: 8,
      salesPoint: 1,
      number: 5,
      date: new Date(2026, 6, 12),
      currency: 'PES',
      netAmount: 100,
      ivaAmount: 21,
      totalAmount: 121,
      cae: '75123456789012',
      caeExpiration: new Date(2026, 6, 22),
      items: [
        { description: 'Servicio de consultoría', quantity: 1, unitPrice: 121, ivaRate: 21, subtotal: 121 },
      ],
      associatedVouchers: [{ type: 6, salesPoint: 1, number: 42 }],
      qrPng: Buffer.alloc(0),
      ...overrides,
    };
  }

  it('genera un PDF válido (magic %PDF)', async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderVoucherPdf(data({ qrPng }));
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('funciona sin receptor (consumidor final) y sin asociados', async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderVoucherPdf(
      data({ qrPng, recipient: null, associatedVouchers: [] }),
    );
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
