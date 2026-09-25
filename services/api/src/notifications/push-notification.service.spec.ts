import { ConfigService } from "@nestjs/config";
import { captureFetchRequests, stubFetchResponse } from "../arca/fetch.fixture";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationService, type PushMessage } from "./push-notification.service";

const PUSH_API_URL = "https://push.test/send";
const HTTP_BAD_GATEWAY = 502;
const ISSUER_ID = "issuer-1";
const MESSAGE: PushMessage = {
  title: "Comprobante emitido",
  body: "CAE otorgado",
  data: { voucherId: "voucher-1" },
};

const originalFetch = global.fetch;

interface Harness {
  service: PushNotificationService;
  tokenQueries: unknown[];
  deletedTokens: string[][];
}

async function harness(tokens: string[] | Error): Promise<Harness> {
  const tokenQueries: unknown[] = [];
  const deletedTokens: string[][] = [];
  const pushToken = {
    findMany: (args: unknown) => {
      tokenQueries.push(args);
      return tokens instanceof Error
        ? Promise.reject(tokens)
        : Promise.resolve(tokens.map((token) => ({ token })));
    },
    deleteMany: ({ where }: { where: { token: { in: string[] } } }) => {
      deletedTokens.push(where.token.in);
      return Promise.resolve({ count: where.token.in.length });
    },
  };
  const service = await instantiateWithDoubles(PushNotificationService, [
    { token: PrismaService, value: { pushToken } },
    { token: ConfigService, value: new ConfigService({ PUSH_API_URL }) },
  ]);
  return { service, tokenQueries, deletedTokens };
}

function tickets(...errors: (string | undefined)[]): string {
  return JSON.stringify({
    data: errors.map((error) =>
      error === undefined ? { status: "ok" } : { status: "error", details: { error } },
    ),
  });
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe("PushNotificationService.notifyIssuerOwner", () => {
  it("sends one message per device of the issuer owner", async () => {
    const { service, tokenQueries } = await harness(["token-a", "token-b"]);
    const requests = captureFetchRequests(tickets(undefined, undefined));

    await service.notifyIssuerOwner(ISSUER_ID, MESSAGE);

    expect(tokenQueries).toEqual([
      { where: { user: { issuers: { some: { id: ISSUER_ID } } } }, select: { token: true } },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(PUSH_API_URL);
    expect(JSON.parse(requests[0]?.body ?? "")).toEqual([
      { to: "token-a", sound: "default", ...MESSAGE },
      { to: "token-b", sound: "default", ...MESSAGE },
    ]);
  });

  it("does not call the push service when the owner has no devices", async () => {
    const { service } = await harness([]);
    const requests = captureFetchRequests(tickets());

    await service.notifyIssuerOwner(ISSUER_ID, MESSAGE);

    expect(requests).toEqual([]);
  });

  it("forgets the devices that the push service reports as unregistered", async () => {
    const { service, deletedTokens } = await harness(["token-a", "token-b", "token-c"]);
    captureFetchRequests(tickets("DeviceNotRegistered", "MessageRateExceeded", "DeviceNotRegistered"));

    await service.notifyIssuerOwner(ISSUER_ID, MESSAGE);

    expect(deletedTokens).toEqual([["token-a", "token-c"]]);
  });

  it("keeps every device when all tickets are ok", async () => {
    const { service, deletedTokens } = await harness(["token-a"]);
    captureFetchRequests(tickets(undefined));

    await service.notifyIssuerOwner(ISSUER_ID, MESSAGE);

    expect(deletedTokens).toEqual([]);
  });

  it("ignores a response whose tickets have an unexpected shape", async () => {
    const { service, deletedTokens } = await harness(["token-a"]);
    stubFetchResponse(JSON.stringify({ unexpected: true }));

    await expect(service.notifyIssuerOwner(ISSUER_ID, MESSAGE)).resolves.toBeUndefined();
    expect(deletedTokens).toEqual([]);
  });

  it("swallows an HTTP error from the push service", async () => {
    const { service, deletedTokens } = await harness(["token-a"]);
    stubFetchResponse("bad gateway", HTTP_BAD_GATEWAY);

    await expect(service.notifyIssuerOwner(ISSUER_ID, MESSAGE)).resolves.toBeUndefined();
    expect(deletedTokens).toEqual([]);
  });

  it("swallows a failure loading the devices", async () => {
    const { service } = await harness(new Error("base caída"));
    const requests = captureFetchRequests(tickets());

    await expect(service.notifyIssuerOwner(ISSUER_ID, MESSAGE)).resolves.toBeUndefined();
    expect(requests).toEqual([]);
  });
});
