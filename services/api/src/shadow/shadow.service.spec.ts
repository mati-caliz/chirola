import {
  IssuerOnboardingStatus,
  TaxTreatment,
  VoucherConcept,
  VoucherType,
  type EmissionPlan,
  type ShadowCompareInput,
} from "@chirola/shared";
import { ShadowService, type EmissionPlanner, type IssuerGrantChecker } from "./shadow.service";
import { prismaDouble } from "../prisma/prisma.fixture";

const API_CLIENT = { id: "client-1", name: "gastronova" };

function buildHarness(plan: EmissionPlan) {
  const stored: { matched: boolean }[] = [];
  const prisma = prismaDouble({
    shadowComparison: {
      create: ({ data }: { data: { matched: boolean } }) => {
        stored.push(data);
        return Promise.resolve(data);
      },
      findMany: () => Promise.resolve(stored),
    },
  });
  const vouchers: EmissionPlanner = {
    computeEmissionPlanForApiClient: () => Promise.resolve(plan),
  };
  const apiClients: IssuerGrantChecker = {
    assertIssuerGranted: () => Promise.resolve(),
  };
  return {
    service: new ShadowService(prisma, vouchers, apiClients),
    stored,
  };
}

function plan(overrides: Partial<EmissionPlan> = {}): EmissionPlan {
  return {
    salesPoint: 1,
    voucherType: 1,
    number: 42,
    netAmount: 1000,
    ivaAmount: 210,
    totalAmount: 1210,
    rates: [],
    verification: {
      onboardingStatus: IssuerOnboardingStatus.ISSUING_CONFIRMED,
      confirmsIssuing: true,
      note: "nota de verificación",
    },
    ...overrides,
  };
}

const VOUCHER: ShadowCompareInput["voucher"] = {
  issuerId: "issuer-1",
  salesPoint: 1,
  voucherType: VoucherType.FACTURA_A,
  concept: VoucherConcept.PRODUCTS,
  recipient: { docType: 80, docNumber: "20111111112" },
  items: [
    { description: "Item", quantity: 1, unitPrice: 1210, ivaRate: 21, taxTreatment: TaxTreatment.TAXED },
  ],
  currency: "PES",
  exchangeRate: 1,
};

function compareInput(expected: ShadowCompareInput["expected"]): ShadowCompareInput {
  return { voucher: VOUCHER, expected };
}

describe("ShadowService", () => {
  it("matched=true cuando número y montos coinciden", async () => {
    const { service, stored } = buildHarness(plan());
    const result = await service.compare(
      API_CLIENT,
      compareInput({ number: 42, netAmount: 1000, ivaAmount: 210, totalAmount: 1210 }),
    );
    expect(result.matched).toBe(true);
    expect(result.differences).toEqual([]);
    expect(stored[0]?.matched).toBe(true);
  });

  it("reporta las diferencias de número y montos", async () => {
    const { service } = buildHarness(plan({ number: 43 }));
    const result = await service.compare(
      API_CLIENT,
      compareInput({ number: 42, netAmount: 1000, ivaAmount: 200, totalAmount: 1210 }),
    );
    expect(result.matched).toBe(false);
    const fields = result.differences.map((difference) => difference.field);
    expect(fields).toEqual(["number", "ivaAmount"]);
  });

  it("tolera diferencias de centavos dentro del umbral", async () => {
    const { service } = buildHarness(plan({ ivaAmount: 210.004 }));
    const result = await service.compare(
      API_CLIENT,
      compareInput({ netAmount: 1000, ivaAmount: 210, totalAmount: 1210 }),
    );
    expect(result.matched).toBe(true);
  });

  it("summary calcula el match rate de la ventana reciente", async () => {
    const { service } = buildHarness(plan());
    await service.compare(API_CLIENT, compareInput({ netAmount: 1000, ivaAmount: 210, totalAmount: 1210 }));
    await service.compare(API_CLIENT, compareInput({ netAmount: 999, ivaAmount: 210, totalAmount: 1210 }));
    const summary = await service.summary(API_CLIENT, "issuer-1");
    expect(summary.total).toBe(2);
    expect(summary.matched).toBe(1);
    expect(summary.matchRate).toBe(50);
  });
});
