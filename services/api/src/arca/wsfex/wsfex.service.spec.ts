import { ConfigService } from '@nestjs/config';
import { ExportType, VoucherLanguage, VoucherType } from '@chirola/shared';
import { ParsedXml } from '../arca-soap.util';
import { RecordedArcaCalls } from '../arca-call-recorder.fixture';
import { WsfexService } from './wsfex.service';
import { WsfexRejectionError } from './wsfex-errors';
import type { ExportCaeRequest } from './wsfex.types';

const recordedCalls = new RecordedArcaCalls();

function service(): WsfexService {
  const config = {
    get: (_key: string, def?: string) => def,
  } as unknown as ConfigService;
  return new WsfexService(config, recordedCalls);
}

function baseRequest(overrides: Partial<ExportCaeRequest> = {}): ExportCaeRequest {
  return {
    requestId: 101,
    salesPoint: 1,
    voucherType: VoucherType.FACTURA_E,
    number: 7,
    date: new Date(2026, 6, 12),
    exportType: ExportType.SERVICES,
    destinationCountryId: 212,
    countryTaxId: '50000000016',
    client: { legalName: 'Acme Inc', address: '1 Infinite Loop, CA' },
    currency: 'DOL',
    exchangeRate: 1305.5,
    language: VoucherLanguage.ENGLISH,
    shippingPermits: [],
    items: [
      {
        description: 'Desarrollo de software',
        quantity: 1,
        unitOfMeasureId: 7,
        unitPrice: 5000,
        discount: 0,
      },
    ],
    totalAmount: 5000,
    associatedVouchers: [],
    ...overrides,
  };
}

describe('WsfexService — armado del comprobante de exportación', () => {
  const build = (request: ExportCaeRequest): string =>
    service().buildRequest(request);

  it('no informa IVA en ningún lado', () => {
    const xml = build(baseRequest());

    expect(xml).not.toContain('Iva');
    expect(xml).not.toContain('ImpIVA');
  });

  it('identifica al receptor por país y CUIT país, sin CUIT argentino', () => {
    const xml = build(baseRequest());

    expect(xml).toContain('<ar:Dst_cmp>212</ar:Dst_cmp>');
    expect(xml).toContain('<ar:Cuit_pais_cliente>50000000016</ar:Cuit_pais_cliente>');
    expect(xml).toContain('<ar:Cliente>Acme Inc</ar:Cliente>');
  });

  it('manda Permiso_existente en N cuando es exportación de servicios', () => {
    const xml = build(baseRequest());

    expect(xml).toContain('<ar:Permiso_existente>N</ar:Permiso_existente>');
    expect(xml).not.toContain('<ar:Permisos>');
  });

  it('arma los permisos de embarque en la exportación de bienes', () => {
    const xml = build(
      baseRequest({
        exportType: ExportType.GOODS,
        shippingPermits: [{ permitId: '16033EC01', destinationCountryId: 212 }],
      }),
    );

    expect(xml).toContain('<ar:Permiso_existente>S</ar:Permiso_existente>');
    expect(xml).toContain(
      '<ar:Permisos><ar:Permiso>' +
        '<ar:Id_permiso>16033EC01</ar:Id_permiso>' +
        '<ar:Dst_merc>212</ar:Dst_merc>' +
        '</ar:Permiso></ar:Permisos>',
    );
  });

  it('calcula el total de cada ítem descontando la bonificación', () => {
    const xml = build(
      baseRequest({
        items: [
          {
            description: 'Consultoría',
            quantity: 10,
            unitOfMeasureId: 7,
            unitPrice: 100,
            discount: 250,
          },
        ],
      }),
    );

    expect(xml).toContain('<ar:Pro_total_item>750.00</ar:Pro_total_item>');
  });

  it('manda el id de request, que es lo que hace idempotente al pedido', () => {
    expect(build(baseRequest())).toContain('<ar:Id>101</ar:Id>');
  });

  it('escapa el texto libre del cliente', () => {
    const xml = build(
      baseRequest({
        client: { legalName: 'Smith & Sons <LLC>', address: 'Main St' },
      }),
    );

    expect(xml).toContain('<ar:Cliente>Smith &amp; Sons &lt;LLC&gt;</ar:Cliente>');
  });

  it('informa el idioma del comprobante', () => {
    expect(build(baseRequest())).toContain('<ar:Idioma_cbte>2</ar:Idioma_cbte>');
  });
});

describe('WsfexService — respuesta de FEXAuthorize', () => {
  const parse = (xml: string) => service().parseAuthorizeResponse(new ParsedXml(xml));

  const authorized =
    '<Resultado>A</Resultado><Cae>68000000000001</Cae>' +
    '<Fch_venc_Cae>20260722</Fch_venc_Cae>';

  it('devuelve el CAE de exportación', () => {
    const result = parse(`<r>${authorized}</r>`);

    expect(result.cae).toBe('68000000000001');
    expect(result.caeVto).toEqual(new Date(2026, 6, 22));
    expect(result.reprocessed).toBe(false);
  });

  it('propaga el error de ARCA cuando ErrCode no es cero', () => {
    expect(() =>
      parse('<r><FEXErr><ErrCode>1201</ErrCode><ErrMsg>Punto de venta inválido</ErrMsg></FEXErr></r>'),
    ).toThrow(WsfexRejectionError);
  });

  it('no confunde ErrCode 0 con un error', () => {
    expect(parse(`<r><FEXErr><ErrCode>0</ErrCode><ErrMsg>OK</ErrMsg></FEXErr>${authorized}</r>`).cae).toBe(
      '68000000000001',
    );
  });

  it('marca el reproceso: ARCA devolvió un comprobante ya emitido', () => {
    const result = parse(`<r>${authorized}<Reproceso>S</Reproceso></r>`);

    expect(result.reprocessed).toBe(true);
    expect(result.cae).toBe('68000000000001');
  });

  it('rechaza cuando el resultado no es aprobado', () => {
    expect(() =>
      parse(
        '<r><Resultado>R</Resultado><Motivos_Obs></Motivos_Obs>' +
          '<Observaciones><Obs><Code>1</Code><Msg>Dato inválido</Msg></Obs></Observaciones></r>',
      ),
    ).toThrow(WsfexRejectionError);
  });

  it('conserva las observaciones de un comprobante igualmente autorizado', () => {
    const result = parse(
      `<r>${authorized}<Observaciones><Obs><Code>2</Code><Msg>Aviso</Msg></Obs></Observaciones></r>`,
    );

    expect(result.observations).toEqual([{ code: '2', message: 'Aviso' }]);
  });
});
