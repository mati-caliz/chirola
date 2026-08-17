import { ConfigService } from '@nestjs/config';
import { VoucherConcept } from '@chirola/shared';
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
    amounts: {
      netAmount: 100,
      ivaAmount: 0,
      exemptAmount: 0,
      untaxedAmount: 0,
      tributeAmount: 0,
      totalAmount: 100,
      rates: [],
      tributes: [],
    },
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
          exemptAmount: 0,
          untaxedAmount: 0,
          tributeAmount: 0,
          totalAmount: 121,
          rates: [{ id: 5, taxableBase: 100, amount: 21 }],
          tributes: [],
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

describe('WsfeService — importes exentos, no gravados y tributos', () => {
  const detail = (request: CaeRequest): string =>
    (service() as unknown as { buildDetail(r: CaeRequest): string }).buildDetail(request);

  const withAmounts = (overrides: Partial<CaeRequest['amounts']>): CaeRequest =>
    baseRequest({ amounts: { ...baseRequest().amounts, ...overrides } });

  it('informa ImpTotConc e ImpOpEx con los importes reales', () => {
    const xml = detail(
      withAmounts({
        netAmount: 1000,
        ivaAmount: 210,
        exemptAmount: 500,
        untaxedAmount: 300,
        totalAmount: 2010,
      }),
    );

    expect(xml).toContain('<ar:ImpTotConc>300.00</ar:ImpTotConc>');
    expect(xml).toContain('<ar:ImpOpEx>500.00</ar:ImpOpEx>');
    expect(xml).toContain('<ar:ImpNeto>1000.00</ar:ImpNeto>');
  });

  it('omite Tributos cuando no hay', () => {
    expect(detail(baseRequest())).not.toContain('Tributos');
  });

  it('arma cada Tributo con Id, Desc, BaseImp, Alic e Importe', () => {
    const xml = detail(
      withAmounts({
        tributeAmount: 30,
        tributes: [
          {
            id: 2,
            description: 'Percepción IIBB CABA',
            taxableBase: 1000,
            rate: 3,
            amount: 30,
          },
        ],
      }),
    );

    expect(xml).toContain('<ar:ImpTrib>30.00</ar:ImpTrib>');
    expect(xml).toContain(
      '<ar:Tributos><ar:Tributo>' +
        '<ar:Id>2</ar:Id>' +
        '<ar:Desc>Percepción IIBB CABA</ar:Desc>' +
        '<ar:BaseImp>1000.00</ar:BaseImp>' +
        '<ar:Alic>3.00</ar:Alic>' +
        '<ar:Importe>30.00</ar:Importe>' +
        '</ar:Tributo></ar:Tributos>',
    );
  });

  it('escapa la descripción del tributo', () => {
    const xml = detail(
      withAmounts({
        tributeAmount: 10,
        tributes: [
          {
            id: 99,
            description: 'Tasa <Municipal> & otros',
            taxableBase: 100,
            rate: 10,
            amount: 10,
          },
        ],
      }),
    );

    expect(xml).toContain('<ar:Desc>Tasa &lt;Municipal&gt; &amp; otros</ar:Desc>');
  });

  it('ubica Tributos entre CbtesAsoc e Iva, como exige el WSDL', () => {
    const xml = detail(
      withAmounts({
        tributeAmount: 30,
        rates: [{ id: 5, taxableBase: 100, amount: 21 }],
        tributes: [
          { id: 2, description: 'IIBB', taxableBase: 1000, rate: 3, amount: 30 },
        ],
      }),
    );

    expect(xml.indexOf('CondicionIVAReceptorId')).toBeLessThan(
      xml.indexOf('<ar:Tributos>'),
    );
    expect(xml.indexOf('<ar:Tributos>')).toBeLessThan(xml.indexOf('<ar:Iva>'));
  });
});

describe('WsfeService — período de servicios', () => {
  const detail = (request: CaeRequest): string =>
    (service() as unknown as { buildDetail(r: CaeRequest): string }).buildDetail(request);

  it('omite las fechas de servicio en comprobantes de productos', () => {
    const xml = detail(baseRequest({ concept: VoucherConcept.PRODUCTS }));

    expect(xml).not.toContain('FchServDesde');
    expect(xml).not.toContain('FchServHasta');
    expect(xml).not.toContain('FchVtoPago');
  });

  it('emite las tres fechas en formato ARCA para comprobantes de servicios', () => {
    const xml = detail(
      baseRequest({
        concept: VoucherConcept.SERVICES,
        servicePeriod: {
          from: '2026-07-01',
          to: '2026-07-31',
          paymentDueDate: '2026-08-10',
        },
      }),
    );

    expect(xml).toContain(
      '<ar:FchServDesde>20260701</ar:FchServDesde>' +
        '<ar:FchServHasta>20260731</ar:FchServHasta>' +
        '<ar:FchVtoPago>20260810</ar:FchVtoPago>',
    );
  });

  it('ubica las fechas de servicio entre ImpIVA y MonId, como exige el WSDL', () => {
    const xml = detail(
      baseRequest({
        concept: VoucherConcept.PRODUCTS_AND_SERVICES,
        servicePeriod: {
          from: '2026-07-01',
          to: '2026-07-31',
          paymentDueDate: '2026-08-10',
        },
      }),
    );

    expect(xml.indexOf('<ar:ImpTrib>')).toBeLessThan(xml.indexOf('<ar:ImpIVA>'));
    expect(xml.indexOf('<ar:ImpIVA>')).toBeLessThan(xml.indexOf('<ar:FchServDesde>'));
    expect(xml.indexOf('<ar:FchVtoPago>')).toBeLessThan(xml.indexOf('<ar:MonId>'));
  });
});

describe('WsfeService — FEParamGetPtosVenta', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const auth = { cuit: '20111111112', token: 't', sign: 's' };

  function respondWith(xml: string): void {
    global.fetch = (async () =>
      new Response(xml, { status: 200 })) as unknown as typeof fetch;
  }

  it('devuelve sólo puntos de venta activos con emisión CAE', async () => {
    respondWith(
      '<soap:Envelope><soap:Body><FEParamGetPtosVentaResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        '<FEParamGetPtosVentaResult><ResultGet>' +
        '<PtoVta><Nro>1</Nro><EmisionTipo>CAE</EmisionTipo><Bloqueado>N</Bloqueado><FchBaja></FchBaja></PtoVta>' +
        '<PtoVta><Nro>2</Nro><EmisionTipo>CAE</EmisionTipo><Bloqueado>S</Bloqueado><FchBaja></FchBaja></PtoVta>' +
        '<PtoVta><Nro>3</Nro><EmisionTipo>CAEA</EmisionTipo><Bloqueado>N</Bloqueado></PtoVta>' +
        '</ResultGet></FEParamGetPtosVentaResult></FEParamGetPtosVentaResponse></soap:Body></soap:Envelope>',
    );

    const result = await service().getSalesPoints(auth);

    expect(result).toEqual([{ number: 1, emissionType: 'CAE' }]);
  });

  it('extrae los ids de tipos de comprobante', async () => {
    respondWith(
      '<soap:Envelope><soap:Body><FEParamGetTiposCbteResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        '<FEParamGetTiposCbteResult><ResultGet>' +
        '<CbteTipo><Id>1</Id><Desc>Factura A</Desc></CbteTipo>' +
        '<CbteTipo><Id>6</Id><Desc>Factura B</Desc></CbteTipo>' +
        '</ResultGet></FEParamGetTiposCbteResult></FEParamGetTiposCbteResponse></soap:Body></soap:Envelope>',
    );

    const result = await service().getVoucherTypeIds(auth);

    expect(result).toEqual([1, 6]);
  });
});

describe('WsfeService — tablas de parámetros', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const auth = { cuit: '20111111112', token: 't', sign: 's' };

  function respondWith(xml: string): void {
    global.fetch = (async () =>
      new Response(xml, { status: 200 })) as unknown as typeof fetch;
  }

  it('extrae los tipos de documento vigentes', async () => {
    respondWith(
      '<soap:Envelope><soap:Body><FEParamGetTiposDocResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        '<FEParamGetTiposDocResult><ResultGet>' +
        '<DocTipo><Id>80</Id><Desc>CUIT</Desc><FchHasta>NULL</FchHasta></DocTipo>' +
        '<DocTipo><Id>96</Id><Desc>DNI</Desc><FchHasta>NULL</FchHasta></DocTipo>' +
        '<DocTipo><Id>1</Id><Desc>Documento viejo</Desc><FchHasta>20050101</FchHasta></DocTipo>' +
        '</ResultGet></FEParamGetTiposDocResult></FEParamGetTiposDocResponse></soap:Body></soap:Envelope>',
    );

    const result = await service().getDocumentTypes(auth);

    expect(result).toEqual([
      { id: 80, description: 'CUIT' },
      { id: 96, description: 'DNI' },
    ]);
  });

  it('extrae los tipos de tributo', async () => {
    respondWith(
      '<soap:Envelope><soap:Body><FEParamGetTiposTributosResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        '<FEParamGetTiposTributosResult><ResultGet>' +
        '<TributoTipo><Id>2</Id><Desc>Provinciales</Desc><FchHasta>NULL</FchHasta></TributoTipo>' +
        '</ResultGet></FEParamGetTiposTributosResult></FEParamGetTiposTributosResponse></soap:Body></soap:Envelope>',
    );

    const result = await service().getTributeTypes(auth);

    expect(result).toEqual([{ id: 2, description: 'Provinciales' }]);
  });

  it('extrae las condiciones de IVA del receptor', async () => {
    respondWith(
      '<soap:Envelope><soap:Body><FEParamGetCondicionIvaReceptorResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        '<FEParamGetCondicionIvaReceptorResult><ResultGet>' +
        '<CondicionIvaReceptor><Id>1</Id><Desc>IVA Responsable Inscripto</Desc></CondicionIvaReceptor>' +
        '<CondicionIvaReceptor><Id>5</Id><Desc>Consumidor Final</Desc></CondicionIvaReceptor>' +
        '</ResultGet></FEParamGetCondicionIvaReceptorResult></FEParamGetCondicionIvaReceptorResponse></soap:Body></soap:Envelope>',
    );

    const result = await service().getRecipientIvaConditions(auth);

    expect(result).toEqual([
      { id: 1, description: 'IVA Responsable Inscripto' },
      { id: 5, description: 'Consumidor Final' },
    ]);
  });
});

describe('WsfeService — monedas y cotización', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const auth = { cuit: '20111111112', token: 't', sign: 's' };

  function respondWith(xml: string): void {
    global.fetch = (async () =>
      new Response(xml, { status: 200 })) as unknown as typeof fetch;
  }

  it('trata FchHasta "NULL" como vigente y descarta las dadas de baja', async () => {
    respondWith(
      '<soap:Envelope><soap:Body><FEParamGetTiposMonedasResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        '<FEParamGetTiposMonedasResult><ResultGet>' +
        '<Moneda><Id>PES</Id><Desc>Pesos Argentinos</Desc><FchDesde>20090403</FchDesde><FchHasta>NULL</FchHasta></Moneda>' +
        '<Moneda><Id>DOL</Id><Desc>Dolar Estadounidense</Desc><FchDesde>20090403</FchDesde><FchHasta></FchHasta></Moneda>' +
        '<Moneda><Id>OLD</Id><Desc>Moneda vieja</Desc><FchDesde>19990101</FchDesde><FchHasta>20100101</FchHasta></Moneda>' +
        '</ResultGet></FEParamGetTiposMonedasResult></FEParamGetTiposMonedasResponse></soap:Body></soap:Envelope>',
    );

    const result = await service().getCurrencies(auth);

    expect(result).toEqual([
      { id: 'PES', description: 'Pesos Argentinos' },
      { id: 'DOL', description: 'Dolar Estadounidense' },
    ]);
  });

  it('devuelve la cotización con su fecha', async () => {
    respondWith(
      '<soap:Envelope><soap:Body><FEParamGetCotizacionResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        '<FEParamGetCotizacionResult><ResultGet>' +
        '<MonId>DOL</MonId><MonCotiz>1305.5</MonCotiz><FchCotiz>20260814</FchCotiz>' +
        '</ResultGet></FEParamGetCotizacionResult></FEParamGetCotizacionResponse></soap:Body></soap:Envelope>',
    );

    const result = await service().getExchangeRate(auth, 'DOL');

    expect(result.currencyId).toBe('DOL');
    expect(result.rate).toBe(1305.5);
    expect(result.date).toEqual(new Date(2026, 7, 14));
  });

  it('manda FchCotiz sólo cuando se pide una fecha', async () => {
    let sentBody = '';
    global.fetch = (async (_url: string, init: { body: string }) => {
      sentBody = init.body;
      return new Response(
        '<soap:Envelope><soap:Body><FEParamGetCotizacionResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
          '<FEParamGetCotizacionResult><ResultGet>' +
          '<MonId>DOL</MonId><MonCotiz>1305.5</MonCotiz><FchCotiz>20260814</FchCotiz>' +
          '</ResultGet></FEParamGetCotizacionResult></FEParamGetCotizacionResponse></soap:Body></soap:Envelope>',
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await service().getExchangeRate(auth, 'DOL');
    expect(sentBody).not.toContain('FchCotiz');

    await service().getExchangeRate(auth, 'DOL', new Date(2026, 7, 14));
    expect(sentBody).toContain('<ar:FchCotiz>20260814</ar:FchCotiz>');
  });

  it('propaga el rechazo de ARCA ante una moneda inexistente', async () => {
    respondWith(
      '<soap:Envelope><soap:Body><FEParamGetCotizacionResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        '<FEParamGetCotizacionResult><Errors><Err><Code>602</Code><Msg>Sin Resultados</Msg></Err></Errors>' +
        '</FEParamGetCotizacionResult></FEParamGetCotizacionResponse></soap:Body></soap:Envelope>',
    );

    await expect(service().getExchangeRate(auth, 'XXX')).rejects.toThrow(
      /Sin Resultados/,
    );
  });
});
