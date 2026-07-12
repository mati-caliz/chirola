import { ConfigService } from '@nestjs/config';
import { WsfeService } from './wsfe.service';
import type { CaeRequest } from './wsfe.types';

function service(): WsfeService {
  const config = {
    get: (_k: string, def?: string) => def,
  } as unknown as ConfigService;
  return new WsfeService(config);
}

function baseReq(overrides: Partial<CaeRequest> = {}): CaeRequest {
  return {
    puntoVenta: 1,
    tipoCbte: 8,
    concepto: 1,
    numero: 5,
    fecha: new Date(2026, 6, 12),
    receptor: { tipoDoc: 80, numeroDoc: '20111111112', condicionIvaId: 1 },
    importes: { impNeto: 100, impIva: 0, impTotal: 100, alicuotas: [] },
    moneda: 'PES',
    cotizacion: 1,
    ...overrides,
  };
}

describe('WsfeService — CbtesAsoc (NC/ND)', () => {
  const detalle = (req: CaeRequest): string =>
    (service() as unknown as { buildDetalle(r: CaeRequest): string }).buildDetalle(req);

  it('no incluye CbtesAsoc cuando no hay asociados', () => {
    expect(detalle(baseReq())).not.toContain('CbtesAsoc');
  });

  it('arma CbteAsoc con tipo/ptoVta/nro y los opcionales cuit/fecha', () => {
    const xml = detalle(
      baseReq({
        comprobantesAsociados: [
          { tipo: 6, puntoVenta: 1, numero: 42, cuit: '20111111112', fecha: '20260701' },
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
    const xml = detalle(
      baseReq({ comprobantesAsociados: [{ tipo: 6, puntoVenta: 1, numero: 42 }] }),
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
    const xml = detalle(
      baseReq({
        importes: {
          impNeto: 100,
          impIva: 21,
          impTotal: 121,
          alicuotas: [{ id: 5, baseImp: 100, importe: 21 }],
        },
        comprobantesAsociados: [{ tipo: 1, puntoVenta: 1, numero: 7 }],
      }),
    );
    const posCond = xml.indexOf('CondicionIVAReceptorId');
    const posAsoc = xml.indexOf('CbtesAsoc');
    const posIva = xml.indexOf('<ar:Iva>');
    expect(posCond).toBeLessThan(posAsoc);
    expect(posAsoc).toBeLessThan(posIva);
  });

  it('soporta múltiples comprobantes asociados', () => {
    const xml = detalle(
      baseReq({
        comprobantesAsociados: [
          { tipo: 6, puntoVenta: 1, numero: 1 },
          { tipo: 6, puntoVenta: 1, numero: 2 },
        ],
      }),
    );
    expect(xml.match(/<ar:CbteAsoc>/g)).toHaveLength(2);
  });
});
