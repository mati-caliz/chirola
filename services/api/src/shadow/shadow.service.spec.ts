import { ShadowService } from './shadow.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ApiClientService } from '../service-auth/api-client.service';
import {
  VouchersService,
  type EmissionPlan,
} from '../vouchers/vouchers.service';
import type { ShadowCompareInput } from '@chirola/shared';

const API_CLIENT = { id: 'client-1', name: 'gastronova' };

function buildHarness(plan: EmissionPlan) {
  const stored: { matched: boolean }[] = [];
  const prisma = {
    shadowComparison: {
      create: jest.fn(async ({ data }: { data: { matched: boolean } }) => {
        stored.push(data);
        return data;
      }),
      findMany: jest.fn(async () => stored),
    },
  } as unknown as PrismaService;
  const vouchers = {
    computeEmissionPlanForApiClient: jest.fn(async () => plan),
  } as unknown as VouchersService;
  const apiClients = {
    assertIssuerGranted: jest.fn(async () => undefined),
  } as unknown as ApiClientService;
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
    ...overrides,
  };
}

function compareInput(
  expected: ShadowCompareInput['expected'],
): ShadowCompareInput {
  return {
    voucher: { issuerId: 'issuer-1' } as ShadowCompareInput['voucher'],
    expected,
  };
}

describe('ShadowService', () => {
  it('matched=true cuando número y montos coinciden', async () => {
    const { service, stored } = buildHarness(plan());
    const result = await service.compare(
      API_CLIENT,
      compareInput({ number: 42, netAmount: 1000, ivaAmount: 210, totalAmount: 1210 }),
    );
    expect(result.matched).toBe(true);
    expect(result.differences).toEqual([]);
    expect(stored[0].matched).toBe(true);
  });

  it('reporta las diferencias de número y montos', async () => {
    const { service } = buildHarness(plan({ number: 43 }));
    const result = await service.compare(
      API_CLIENT,
      compareInput({ number: 42, netAmount: 1000, ivaAmount: 200, totalAmount: 1210 }),
    );
    expect(result.matched).toBe(false);
    const fields = result.differences.map((d) => d.field);
    expect(fields).toEqual(['number', 'ivaAmount']);
  });

  it('tolera diferencias de centavos dentro del umbral', async () => {
    const { service } = buildHarness(plan({ ivaAmount: 210.004 }));
    const result = await service.compare(
      API_CLIENT,
      compareInput({ netAmount: 1000, ivaAmount: 210, totalAmount: 1210 }),
    );
    expect(result.matched).toBe(true);
  });

  it('summary calcula el match rate de la ventana reciente', async () => {
    const { service } = buildHarness(plan());
    await service.compare(
      API_CLIENT,
      compareInput({ netAmount: 1000, ivaAmount: 210, totalAmount: 1210 }),
    );
    await service.compare(
      API_CLIENT,
      compareInput({ netAmount: 999, ivaAmount: 210, totalAmount: 1210 }),
    );
    const summary = await service.summary(API_CLIENT, 'issuer-1');
    expect(summary.total).toBe(2);
    expect(summary.matched).toBe(1);
    expect(summary.matchRate).toBe(50);
  });
});
