import { buildQrUrl } from './qr.util';

describe('buildQrUrl', () => {
  it('genera la URL de ARCA con el payload correcto en base64', () => {
    const url = buildQrUrl({
      date: new Date(2026, 6, 12),
      issuerCuit: '20111111112',
      salesPoint: 1,
      voucherType: 11,
      number: 42,
      totalAmount: 1210,
      currency: 'PES',
      exchangeRate: 1,
      recipientDocType: 99,
      recipientDocNumber: '0',
      cae: '75123456789012',
    });
    expect(url.startsWith('https://www.afip.gob.ar/fe/qr/?p=')).toBe(true);
    const b64 = url.replace('https://www.afip.gob.ar/fe/qr/?p=', '');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    expect(payload).toMatchObject({
      ver: 1,
      fecha: '2026-07-12',
      cuit: 20111111112,
      ptoVta: 1,
      tipoCmp: 11,
      nroCmp: 42,
      importe: 1210,
      tipoCodAut: 'E',
      codAut: 75123456789012,
    });
  });
});
