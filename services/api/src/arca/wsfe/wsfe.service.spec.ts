import { ConfigService } from "@nestjs/config";
import { WsfeService } from "./wsfe.service";
import { RecordedArcaCalls } from "../arca-call-recorder.fixture";
import { captureFetchRequests, stubFetchResponse } from "../fetch.fixture";
import { baseCaeRequest } from "./wsfe-request.fixture";
import type { CaeResult } from "./wsfe.types";

const AUTH = {
  issuerId: "issuer-1",
  cuit: "20111111112",
  token: "t",
  sign: "s",
  environment: "homologacion",
};

const recordedCalls = new RecordedArcaCalls();

function service(): WsfeService {
  return new WsfeService(new ConfigService(), recordedCalls);
}

describe("WsfeService — FEParamGetPtosVenta", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const auth = AUTH;

  it("devuelve sólo puntos de venta activos con emisión CAE", async () => {
    stubFetchResponse(
      '<soap:Envelope><soap:Body><FEParamGetPtosVentaResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetPtosVentaResult><ResultGet>" +
        "<PtoVta><Nro>1</Nro><EmisionTipo>CAE</EmisionTipo><Bloqueado>N</Bloqueado><FchBaja></FchBaja></PtoVta>" +
        "<PtoVta><Nro>2</Nro><EmisionTipo>CAE</EmisionTipo><Bloqueado>S</Bloqueado><FchBaja></FchBaja></PtoVta>" +
        "<PtoVta><Nro>3</Nro><EmisionTipo>CAEA</EmisionTipo><Bloqueado>N</Bloqueado></PtoVta>" +
        "</ResultGet></FEParamGetPtosVentaResult></FEParamGetPtosVentaResponse></soap:Body></soap:Envelope>",
    );

    const result = await service().getSalesPoints(auth);

    expect(result).toEqual([{ number: 1, emissionType: "CAE" }]);
  });

  it("extrae los ids de tipos de comprobante", async () => {
    stubFetchResponse(
      '<soap:Envelope><soap:Body><FEParamGetTiposCbteResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetTiposCbteResult><ResultGet>" +
        "<CbteTipo><Id>1</Id><Desc>Factura A</Desc></CbteTipo>" +
        "<CbteTipo><Id>6</Id><Desc>Factura B</Desc></CbteTipo>" +
        "</ResultGet></FEParamGetTiposCbteResult></FEParamGetTiposCbteResponse></soap:Body></soap:Envelope>",
    );

    const result = await service().getVoucherTypeIds(auth);

    expect(result).toEqual([1, 6]);
  });
});

describe("WsfeService — tablas de parámetros", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const auth = AUTH;

  it("extrae los tipos de documento vigentes", async () => {
    stubFetchResponse(
      '<soap:Envelope><soap:Body><FEParamGetTiposDocResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetTiposDocResult><ResultGet>" +
        "<DocTipo><Id>80</Id><Desc>CUIT</Desc><FchHasta>NULL</FchHasta></DocTipo>" +
        "<DocTipo><Id>96</Id><Desc>DNI</Desc><FchHasta>NULL</FchHasta></DocTipo>" +
        "<DocTipo><Id>1</Id><Desc>Documento viejo</Desc><FchHasta>20050101</FchHasta></DocTipo>" +
        "</ResultGet></FEParamGetTiposDocResult></FEParamGetTiposDocResponse></soap:Body></soap:Envelope>",
    );

    const result = await service().getDocumentTypes(auth);

    expect(result).toEqual([
      { id: 80, description: "CUIT" },
      { id: 96, description: "DNI" },
    ]);
  });

  it("extrae los tipos de tributo", async () => {
    stubFetchResponse(
      '<soap:Envelope><soap:Body><FEParamGetTiposTributosResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetTiposTributosResult><ResultGet>" +
        "<TributoTipo><Id>2</Id><Desc>Provinciales</Desc><FchHasta>NULL</FchHasta></TributoTipo>" +
        "</ResultGet></FEParamGetTiposTributosResult></FEParamGetTiposTributosResponse></soap:Body></soap:Envelope>",
    );

    const result = await service().getTributeTypes(auth);

    expect(result).toEqual([{ id: 2, description: "Provinciales" }]);
  });

  it("extrae las condiciones de IVA del receptor", async () => {
    stubFetchResponse(
      '<soap:Envelope><soap:Body><FEParamGetCondicionIvaReceptorResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetCondicionIvaReceptorResult><ResultGet>" +
        "<CondicionIvaReceptor><Id>1</Id><Desc>IVA Responsable Inscripto</Desc></CondicionIvaReceptor>" +
        "<CondicionIvaReceptor><Id>5</Id><Desc>Consumidor Final</Desc></CondicionIvaReceptor>" +
        "</ResultGet></FEParamGetCondicionIvaReceptorResult></FEParamGetCondicionIvaReceptorResponse></soap:Body></soap:Envelope>",
    );

    const result = await service().getRecipientIvaConditions(auth);

    expect(result).toEqual([
      { id: 1, description: "IVA Responsable Inscripto" },
      { id: 5, description: "Consumidor Final" },
    ]);
  });
});

describe("WsfeService — monedas y cotización", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const auth = AUTH;

  it('trata FchHasta "NULL" como vigente y descarta las dadas de baja', async () => {
    stubFetchResponse(
      '<soap:Envelope><soap:Body><FEParamGetTiposMonedasResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetTiposMonedasResult><ResultGet>" +
        "<Moneda><Id>PES</Id><Desc>Pesos Argentinos</Desc><FchDesde>20090403</FchDesde><FchHasta>NULL</FchHasta></Moneda>" +
        "<Moneda><Id>DOL</Id><Desc>Dolar Estadounidense</Desc><FchDesde>20090403</FchDesde><FchHasta></FchHasta></Moneda>" +
        "<Moneda><Id>OLD</Id><Desc>Moneda vieja</Desc><FchDesde>19990101</FchDesde><FchHasta>20100101</FchHasta></Moneda>" +
        "</ResultGet></FEParamGetTiposMonedasResult></FEParamGetTiposMonedasResponse></soap:Body></soap:Envelope>",
    );

    const result = await service().getCurrencies(auth);

    expect(result).toEqual([
      { id: "PES", description: "Pesos Argentinos" },
      { id: "DOL", description: "Dolar Estadounidense" },
    ]);
  });

  it("devuelve la cotización con su fecha", async () => {
    stubFetchResponse(
      '<soap:Envelope><soap:Body><FEParamGetCotizacionResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetCotizacionResult><ResultGet>" +
        "<MonId>DOL</MonId><MonCotiz>1305.5</MonCotiz><FchCotiz>20260814</FchCotiz>" +
        "</ResultGet></FEParamGetCotizacionResult></FEParamGetCotizacionResponse></soap:Body></soap:Envelope>",
    );

    const result = await service().getExchangeRate(auth, "DOL");

    expect(result.currencyId).toBe("DOL");
    expect(result.rate).toBe(1305.5);
    expect(result.date).toEqual(new Date(2026, 7, 14));
  });

  it("manda FchCotiz sólo cuando se pide una fecha", async () => {
    const requests = captureFetchRequests(
      '<soap:Envelope><soap:Body><FEParamGetCotizacionResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetCotizacionResult><ResultGet>" +
        "<MonId>DOL</MonId><MonCotiz>1305.5</MonCotiz><FchCotiz>20260814</FchCotiz>" +
        "</ResultGet></FEParamGetCotizacionResult></FEParamGetCotizacionResponse></soap:Body></soap:Envelope>",
    );

    await service().getExchangeRate(auth, "DOL");
    expect(requests.at(-1)?.body).not.toContain("FchCotiz");

    await service().getExchangeRate(auth, "DOL", new Date(2026, 7, 14));
    expect(requests.at(-1)?.body).toContain("<ar:FchCotiz>20260814</ar:FchCotiz>");
  });

  it("propaga el rechazo de ARCA ante una moneda inexistente", async () => {
    stubFetchResponse(
      '<soap:Envelope><soap:Body><FEParamGetCotizacionResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
        "<FEParamGetCotizacionResult><Errors><Err><Code>602</Code><Msg>Sin Resultados</Msg></Err></Errors>" +
        "</FEParamGetCotizacionResult></FEParamGetCotizacionResponse></soap:Body></soap:Envelope>",
    );

    await expect(service().getExchangeRate(auth, "XXX")).rejects.toThrow(/Sin Resultados/);
  });
});

describe("WsfeService — entorno por emisor", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const emptySalesPoints =
    '<soap:Envelope><soap:Body><FEParamGetPtosVentaResponse xmlns="http://ar.gov.afip.dif.FEV1/">' +
    "<FEParamGetPtosVentaResult><ResultGet></ResultGet></FEParamGetPtosVentaResult>" +
    "</FEParamGetPtosVentaResponse></soap:Body></soap:Envelope>";

  async function urlUsedFor(environment: string): Promise<string> {
    const requests = captureFetchRequests(emptySalesPoints);

    await service().getSalesPoints({ ...AUTH, environment });
    return requests.at(-1)?.url ?? "";
  }

  it("usa el WSFEv1 de homologacion para un emisor de homologacion", async () => {
    expect(await urlUsedFor("homologacion")).toBe("https://wswhomo.afip.gov.ar/wsfev1/service.asmx");
  });

  it("usa el WSFEv1 de produccion para un emisor de produccion", async () => {
    expect(await urlUsedFor("produccion")).toBe("https://servicios1.afip.gov.ar/wsfev1/service.asmx");
  });
});

describe("WsfeService — observaciones del CAE", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const parse = (res: string): Promise<CaeResult> => {
    stubFetchResponse(res);
    return service().requestCae(AUTH, baseCaeRequest());
  };

  const caeBody = "<Resultado>A</Resultado><CAE>74000000000001</CAE><CAEFchVto>20260722</CAEFchVto>";

  it("devuelve el CAE sin observaciones cuando ARCA no manda ninguna", async () => {
    expect((await parse(`<r>${caeBody}</r>`)).observations).toEqual([]);
  });

  it("extrae código y mensaje de cada observación", async () => {
    const res =
      `<r>${caeBody}<Observaciones>` +
      "<Obs><Code>10013</Code><Msg>Fecha fuera de rango</Msg></Obs>" +
      "<Obs><Code>10071</Code><Msg>Cotización no informada</Msg></Obs>" +
      "</Observaciones></r>";

    expect((await parse(res)).observations).toEqual([
      { code: "10013", message: "Fecha fuera de rango" },
      { code: "10071", message: "Cotización no informada" },
    ]);
  });

  it("no confunde una observación con un rechazo: el CAE se otorga igual", async () => {
    const res = `<r>${caeBody}<Observaciones><Obs><Code>10013</Code><Msg>Aviso</Msg></Obs></Observaciones></r>`;

    expect((await parse(res)).cae).toBe("74000000000001");
  });
});
