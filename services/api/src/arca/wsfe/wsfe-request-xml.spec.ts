import { VoucherConcept } from "@chirola/shared";
import { buildCaeDetail } from "./wsfe-request-xml";
import { baseCaeRequest } from "./wsfe-request.fixture";
import type { CaeRequest } from "./wsfe.types";

describe("buildCaeDetail — CbtesAsoc (NC/ND)", () => {
  it("no incluye CbtesAsoc cuando no hay asociados", () => {
    expect(buildCaeDetail(baseCaeRequest())).not.toContain("CbtesAsoc");
  });

  it("arma CbteAsoc con tipo/ptoVta/nro y los opcionales cuit/fecha", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({
        associatedVouchers: [{ type: 6, salesPoint: 1, number: 42, cuit: "20111111112", date: "20260701" }],
      }),
    );
    expect(xml).toContain(
      "<ar:CbtesAsoc><ar:CbteAsoc>" +
        "<ar:Tipo>6</ar:Tipo>" +
        "<ar:PtoVta>1</ar:PtoVta>" +
        "<ar:Nro>42</ar:Nro>" +
        "<ar:Cuit>20111111112</ar:Cuit>" +
        "<ar:CbteFch>20260701</ar:CbteFch>" +
        "</ar:CbteAsoc></ar:CbtesAsoc>",
    );
  });

  it("omite cuit y fecha cuando no se pasan", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({ associatedVouchers: [{ type: 6, salesPoint: 1, number: 42 }] }),
    );

    expect(xml).toContain(
      "<ar:CbtesAsoc><ar:CbteAsoc>" +
        "<ar:Tipo>6</ar:Tipo>" +
        "<ar:PtoVta>1</ar:PtoVta>" +
        "<ar:Nro>42</ar:Nro>" +
        "</ar:CbteAsoc></ar:CbtesAsoc>",
    );
  });

  it("coloca CbtesAsoc después de CondicionIVAReceptorId y antes de Iva (orden XSD)", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({
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
    const posCond = xml.indexOf("CondicionIVAReceptorId");
    const posAsoc = xml.indexOf("CbtesAsoc");
    const posIva = xml.indexOf("<ar:Iva>");
    expect(posCond).toBeLessThan(posAsoc);
    expect(posAsoc).toBeLessThan(posIva);
  });

  it("soporta múltiples comprobantes asociados", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({
        associatedVouchers: [
          { type: 6, salesPoint: 1, number: 1 },
          { type: 6, salesPoint: 1, number: 2 },
        ],
      }),
    );
    expect(xml.match(/<ar:CbteAsoc>/g)).toHaveLength(2);
  });
});

describe("buildCaeDetail — importes exentos, no gravados y tributos", () => {
  const withAmounts = (overrides: Partial<CaeRequest["amounts"]>): CaeRequest =>
    baseCaeRequest({ amounts: { ...baseCaeRequest().amounts, ...overrides } });

  it("informa ImpTotConc e ImpOpEx con los importes reales", () => {
    const xml = buildCaeDetail(
      withAmounts({
        netAmount: 1000,
        ivaAmount: 210,
        exemptAmount: 500,
        untaxedAmount: 300,
        totalAmount: 2010,
      }),
    );

    expect(xml).toContain("<ar:ImpTotConc>300.00</ar:ImpTotConc>");
    expect(xml).toContain("<ar:ImpOpEx>500.00</ar:ImpOpEx>");
    expect(xml).toContain("<ar:ImpNeto>1000.00</ar:ImpNeto>");
  });

  it("omite Tributos cuando no hay", () => {
    expect(buildCaeDetail(baseCaeRequest())).not.toContain("Tributos");
  });

  it("arma cada Tributo con Id, Desc, BaseImp, Alic e Importe", () => {
    const xml = buildCaeDetail(
      withAmounts({
        tributeAmount: 30,
        tributes: [
          {
            id: 2,
            description: "Percepción IIBB CABA",
            taxableBase: 1000,
            rate: 3,
            amount: 30,
          },
        ],
      }),
    );

    expect(xml).toContain("<ar:ImpTrib>30.00</ar:ImpTrib>");
    expect(xml).toContain(
      "<ar:Tributos><ar:Tributo>" +
        "<ar:Id>2</ar:Id>" +
        "<ar:Desc>Percepción IIBB CABA</ar:Desc>" +
        "<ar:BaseImp>1000.00</ar:BaseImp>" +
        "<ar:Alic>3.00</ar:Alic>" +
        "<ar:Importe>30.00</ar:Importe>" +
        "</ar:Tributo></ar:Tributos>",
    );
  });

  it("escapa la descripción del tributo", () => {
    const xml = buildCaeDetail(
      withAmounts({
        tributeAmount: 10,
        tributes: [
          {
            id: 99,
            description: "Tasa <Municipal> & otros",
            taxableBase: 100,
            rate: 10,
            amount: 10,
          },
        ],
      }),
    );

    expect(xml).toContain("<ar:Desc>Tasa &lt;Municipal&gt; &amp; otros</ar:Desc>");
  });

  it("ubica Tributos entre CbtesAsoc e Iva, como exige el WSDL", () => {
    const xml = buildCaeDetail(
      withAmounts({
        tributeAmount: 30,
        rates: [{ id: 5, taxableBase: 100, amount: 21 }],
        tributes: [{ id: 2, description: "IIBB", taxableBase: 1000, rate: 3, amount: 30 }],
      }),
    );

    expect(xml.indexOf("CondicionIVAReceptorId")).toBeLessThan(xml.indexOf("<ar:Tributos>"));
    expect(xml.indexOf("<ar:Tributos>")).toBeLessThan(xml.indexOf("<ar:Iva>"));
  });
});

describe("buildCaeDetail — período de servicios", () => {
  it("omite las fechas de servicio en comprobantes de productos", () => {
    const xml = buildCaeDetail(baseCaeRequest({ concept: VoucherConcept.PRODUCTS }));

    expect(xml).not.toContain("FchServDesde");
    expect(xml).not.toContain("FchServHasta");
    expect(xml).not.toContain("FchVtoPago");
  });

  it("emite las tres fechas en formato ARCA para comprobantes de servicios", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({
        concept: VoucherConcept.SERVICES,
        servicePeriod: { from: "2026-07-01", to: "2026-07-31" },
        paymentDueDate: "2026-08-10",
      }),
    );

    expect(xml).toContain(
      "<ar:FchServDesde>20260701</ar:FchServDesde>" +
        "<ar:FchServHasta>20260731</ar:FchServHasta>" +
        "<ar:FchVtoPago>20260810</ar:FchVtoPago>",
    );
  });

  it("ubica las fechas de servicio entre ImpIVA y MonId, como exige el WSDL", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({
        concept: VoucherConcept.PRODUCTS_AND_SERVICES,
        servicePeriod: { from: "2026-07-01", to: "2026-07-31" },
        paymentDueDate: "2026-08-10",
      }),
    );

    expect(xml.indexOf("<ar:ImpTrib>")).toBeLessThan(xml.indexOf("<ar:ImpIVA>"));
    expect(xml.indexOf("<ar:ImpIVA>")).toBeLessThan(xml.indexOf("<ar:FchServDesde>"));
    expect(xml.indexOf("<ar:FchVtoPago>")).toBeLessThan(xml.indexOf("<ar:MonId>"));
  });
});

describe("buildCaeDetail — Opcionales (C.2)", () => {
  it("omite el nodo cuando no hay opcionales", () => {
    expect(buildCaeDetail(baseCaeRequest())).not.toContain("Opcionales");
  });

  it("arma un Opcional por cada id/valor", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({
        optionals: [
          { id: 2101, value: "2850590940090418135201" },
          { id: 27, value: "SCA" },
        ],
      }),
    );

    expect(xml).toContain(
      "<ar:Opcionales>" +
        "<ar:Opcional><ar:Id>2101</ar:Id>" +
        "<ar:Valor>2850590940090418135201</ar:Valor></ar:Opcional>" +
        "<ar:Opcional><ar:Id>27</ar:Id><ar:Valor>SCA</ar:Valor></ar:Opcional>" +
        "</ar:Opcionales>",
    );
  });

  it("ubica Opcionales después de Iva, como exige el WSDL", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({
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
        optionals: [{ id: 27, value: "ADC" }],
      }),
    );

    expect(xml.indexOf("<ar:Iva>")).toBeLessThan(xml.indexOf("<ar:Opcionales>"));
  });

  it("emite el vencimiento de pago sin período de servicio (FCE de productos)", () => {
    const xml = buildCaeDetail(
      baseCaeRequest({ concept: VoucherConcept.PRODUCTS, paymentDueDate: "2026-09-30" }),
    );

    expect(xml).not.toContain("FchServDesde");
    expect(xml).toContain("<ar:FchVtoPago>20260930</ar:FchVtoPago>");
  });
});
