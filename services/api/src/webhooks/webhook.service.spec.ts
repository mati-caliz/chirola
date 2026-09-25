import { createHmac } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { WebhookService } from "./webhook.service";
import { WebhookEvent, SIGNATURE_HEADER, EVENT_HEADER } from "./webhook-events";
import { prismaDouble } from "../prisma/prisma.fixture";
import type { PrismaService } from "../prisma/prisma.service";

const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;

interface DeliveredRequest {
  body: string;
  headers: Headers;
}

function config(): ConfigService {
  return new ConfigService({
    WEBHOOK_MAX_ATTEMPTS: 3,
    WEBHOOK_BASE_DELAY_MS: 0,
    WEBHOOK_TIMEOUT_MS: 1_000,
  });
}

function prismaWith(
  grants: { apiClientId: string }[],
  endpoints: { url: string; secret: string }[],
): PrismaService {
  return prismaDouble({
    apiClientIssuer: { findMany: () => Promise.resolve(grants) },
    webhookEndpoint: { findMany: () => Promise.resolve(endpoints) },
  });
}

function stubFetchStatuses(statuses: number[]): DeliveredRequest[] {
  const delivered: DeliveredRequest[] = [];
  global.fetch = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    delivered.push({
      body: typeof init?.body === "string" ? init.body : "",
      headers: new Headers(init?.headers),
    });
    const status = statuses[delivered.length - 1] ?? HTTP_OK;
    return Promise.resolve(new Response(null, { status }));
  };
  return delivered;
}

describe("WebhookService", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("firma el payload con HMAC-SHA256 del secret del endpoint", async () => {
    const delivered = stubFetchStatuses([HTTP_OK]);
    const secret = "top-secret";
    const prisma = prismaWith([{ apiClientId: "client-1" }], [{ url: "https://hook.test/x", secret }]);
    const service = new WebhookService(prisma, config());

    await service.dispatch("issuer-1", WebhookEvent.VOUCHER_ISSUED, { id: "v1" });

    expect(delivered).toHaveLength(1);
    const body = delivered[0]?.body ?? "";
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    expect(delivered[0]?.headers.get(SIGNATURE_HEADER)).toBe(`sha256=${expected}`);
    expect(delivered[0]?.headers.get(EVENT_HEADER)).toBe(WebhookEvent.VOUCHER_ISSUED);
    expect(JSON.parse(body)).toMatchObject({
      event: WebhookEvent.VOUCHER_ISSUED,
      issuerId: "issuer-1",
      data: { id: "v1" },
    });
  });

  it("reintenta ante respuesta no-OK hasta que responde 200", async () => {
    const delivered = stubFetchStatuses([HTTP_SERVER_ERROR, HTTP_OK]);
    const prisma = prismaWith([{ apiClientId: "client-1" }], [{ url: "https://hook.test/x", secret: "s" }]);
    const service = new WebhookService(prisma, config());

    await service.dispatch("issuer-1", WebhookEvent.VOUCHER_FAILED, {});

    expect(delivered).toHaveLength(2);
  });

  it("no dispara si el emisor no tiene grants con webhook", async () => {
    const delivered = stubFetchStatuses([]);
    const service = new WebhookService(prismaWith([], []), config());

    await service.dispatch("issuer-1", WebhookEvent.VOUCHER_ISSUED, {});

    expect(delivered).toHaveLength(0);
  });
});
