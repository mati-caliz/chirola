import { ConfigService } from '@nestjs/config';
import { WsfeService } from './wsfe.service';
import type { CaeRequest } from './wsfe.types';

function service(): WsfeService {
  const config = {
    get: (_k: string, def?: string) => def,
  } as unknown as ConfigService;
  return new WsfeService(config);
}

function baseRequest(overrides: Partial<CaeRequest> = {}): CaeRequest {
  return {
    salesPoint: 1,
    voucherType: 8,
    concept: 1,
    number: 5,
    date: new Date(2026, 6, 12),
    recipient: { docType: 80, docNumber: '20111111112', ivaConditionId: 1 },
    amounts: { netAmount: 100, ivaAmount: 0, totalAmount: 100, rates: [] },
    currency: 'PES',
    exchangeRate: 1,
    ...overrides,
  };
}

describe('WsfeService — CbtesAsoc (NC/ND)', () => {
  const detail = (request: CaeRequest): string =>
    (service() as unknown as { buildDetail(r: CaeRequest): string }).buildDetail(request);

  it('no incluye CbtesAsoc cuando no hay asociados', () => {
    expect(detail(baseRequest())).not.toContain('CbtesAsoc');
  });

  it('arma CbteAsoc con tipo/ptoVta/nro y los opcionales cuit/fecha', () => {
    const xml = detail(
      baseRequest({
        associatedVouchers: [
          { type: 6, salesPoint: 1, number: 42, cuit: '20111111112', date: '20260701' },
        ],
      }),
    );
    expect(xml).toContain(
      '<ar:CbtesAsoc><ar:CbteAsoc>' +
        '<ar:Tipo>6</ar:Tipo>' +
        '<ar:PtoVta>1</ar:PtoVta>' +
        '<ar:Nro>42</ar:Nro>' +
        '<ar:Cuit>20111111112</ar:Cuit>' +
        '<ar:CbteFch>20260701</ar:CbteFch>' +
        '</ar:CbteAsoc></ar:CbtesAsoc>',
    );
  });

  it('omite cuit y fecha cuando no se pasan', () => {
    const xml = detail(
      baseRequest({ associatedVouchers: [{ type: 6, salesPoint: 1, number: 42 }] }),
    );

    expect(xml).toContain(
      '<ar:CbtesAsoc><ar:CbteAsoc>' +
        '<ar:Tipo>6</ar:Tipo>' +
        '<ar:PtoVta>1</ar:PtoVta>' +
        '<ar:Nro>42</ar:Nro>' +
        '</ar:CbteAsoc></ar:CbtesAsoc>',
    );
  });

  it('coloca CbtesAsoc después de CondicionIVAReceptorId y antes de Iva (orden XSD)', () => {
    const xml = detail(
      baseRequest({
        amounts: {
          netAmount: 100,
          ivaAmount: 21,
          totalAmount: 121,
          rates: [{ id: 5, taxableBase: 100, amount: 21 }],
        },
        associatedVouchers: [{ type: 1, salesPoint: 1, number: 7 }],
      }),
    );
    const posCond = xml.indexOf('CondicionIVAReceptorId');
    const posAsoc = xml.indexOf('CbtesAsoc');
    const posIva = xml.indexOf('<ar:Iva>');
    expect(posCond).toBeLessThan(posAsoc);
    expect(posAsoc).toBeLessThan(posIva);
  });

  it('soporta múltiples comprobantes asociados', () => {
    const xml = detail(
      baseRequest({
        associatedVouchers: [
          { type: 6, salesPoint: 1, number: 1 },
          { type: 6, salesPoint: 1, number: 2 },
        ],
      }),
    );
    expect(xml.match(/<ar:CbteAsoc>/g)).toHaveLength(2);
  });
});
