import { renderQrPng, receptorDesdeQr } from './qr-image.util';
import { renderComprobantePdf, type ComprobantePdfData } from './pdf.util';
import { buildQrUrl } from './qr.util';

const qrUrl = buildQrUrl({
  fecha: new Date(2026, 6, 12),
  cuitEmisor: '20111111112',
  puntoVenta: 1,
  tipoCbte: 8,
  numero: 5,
  importeTotal: 121,
  moneda: 'PES',
  cotizacion: 1,
  tipoDocReceptor: 80,
  nroDocReceptor: '30707153745',
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
    expect(receptorDesdeQr(qrUrl)).toEqual({ tipoDoc: 80, nroDoc: '30707153745' });
  });

  it('devuelve null si la URL no tiene payload', () => {
    expect(receptorDesdeQr('https://afip.gob.ar/fe/qr/')).toBeNull();
    expect(receptorDesdeQr('basura')).toBeNull();
  });
});

describe('pdf util', () => {
  function data(overrides: Partial<ComprobantePdfData> = {}): ComprobantePdfData {
    return {
      emisor: { razonSocial: 'Acme SA', cuit: '20111111112', condicionIva: 'RESPONSABLE_INSCRIPTO' },
      receptor: { tipoDoc: 80, nroDoc: '30707153745' },
      tipoCbte: 8,
      puntoVenta: 1,
      numero: 5,
      fecha: new Date(2026, 6, 12),
      moneda: 'PES',
      impNeto: 100,
      impIva: 21,
      impTotal: 121,
      cae: '75123456789012',
      caeVto: new Date(2026, 6, 22),
      items: [
        { descripcion: 'Servicio de consultoría', cantidad: 1, precioUnit: 121, alicuotaIva: 21, subtotal: 121 },
      ],
      comprobantesAsociados: [{ tipo: 6, puntoVenta: 1, numero: 42 }],
      qrPng: Buffer.alloc(0),
      ...overrides,
    };
  }

  it('genera un PDF válido (magic %PDF)', async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderComprobantePdf(data({ qrPng }));
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('funciona sin receptor (consumidor final) y sin asociados', async () => {
    const qrPng = await renderQrPng(qrUrl);
    const pdf = await renderComprobantePdf(
      data({ qrPng, receptor: null, comprobantesAsociados: [] }),
    );
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
