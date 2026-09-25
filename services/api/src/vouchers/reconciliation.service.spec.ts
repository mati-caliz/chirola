import { fakeIssuerAuth } from "../issuer-arca/issuer-arca.fixture";
import { ReconciliationService, type LastAuthorizedLookup } from "./reconciliation.service";
import type { NumberingGroup, NumberingTables } from "./voucher-tables";

const issuer = {
  id: "issuer-1",
  cuit: "20111111112",
  environment: "homologacion",
  representativeCuit: null,
};

function build(options: {
  groups?: NumberingGroup[];
  lastInArca?: Record<number, number>;
}): ReconciliationService {
  const tables: NumberingTables = {
    voucher: {
      groupBy: () => Promise.resolve(options.groups ?? []),
    },
    salesPoint: {
      findMany: () => Promise.resolve([{ id: "sp-1", number: 1 }]),
    },
  };

  const wsfe: LastAuthorizedLookup = {
    getLastAuthorized: (_auth, _salesPoint, voucherType) =>
      Promise.resolve(options.lastInArca?.[voucherType] ?? 0),
  };

  return new ReconciliationService(tables, fakeIssuerAuth(), wsfe);
}

describe("ReconciliationService", () => {
  it("no consulta ARCA si el emisor no tiene comprobantes", async () => {
    const service = build({ groups: [] });

    expect(await service.checkNumbering(issuer)).toEqual([]);
  });

  it("reporta cero faltantes cuando la base está al día", async () => {
    const service = build({
      groups: [{ salesPointId: "sp-1", voucherType: 11, _max: { number: 42 } }],
      lastInArca: { 11: 42 },
    });

    const [status] = await service.checkNumbering(issuer);

    expect(status?.missingInDatabase).toBe(0);
    expect(status?.lastInArca).toBe(42);
    expect(status?.lastInDatabase).toBe(42);
  });

  it("detecta comprobantes que ARCA autorizó y la base no tiene", async () => {
    const service = build({
      groups: [{ salesPointId: "sp-1", voucherType: 11, _max: { number: 40 } }],
      lastInArca: { 11: 43 },
    });

    const [status] = await service.checkNumbering(issuer);

    expect(status?.missingInDatabase).toBe(3);
  });

  it("no reporta faltantes negativos si la base va adelante", async () => {
    const service = build({
      groups: [{ salesPointId: "sp-1", voucherType: 11, _max: { number: 50 } }],
      lastInArca: { 11: 42 },
    });

    const [status] = await service.checkNumbering(issuer);

    expect(status?.missingInDatabase).toBe(0);
  });

  it("revisa cada combinación de punto de venta y tipo", async () => {
    const service = build({
      groups: [
        { salesPointId: "sp-1", voucherType: 11, _max: { number: 10 } },
        { salesPointId: "sp-1", voucherType: 13, _max: { number: 2 } },
      ],
      lastInArca: { 11: 12, 13: 2 },
    });

    const statuses = await service.checkNumbering(issuer);

    expect(statuses).toHaveLength(2);
    expect(statuses[0]?.missingInDatabase).toBe(2);
    expect(statuses[1]?.missingInDatabase).toBe(0);
  });

  it("ignora grupos cuyo punto de venta ya no existe", async () => {
    const service = build({
      groups: [{ salesPointId: "sp-borrado", voucherType: 11, _max: { number: 5 } }],
      lastInArca: { 11: 9 },
    });

    expect(await service.checkNumbering(issuer)).toEqual([]);
  });
});
