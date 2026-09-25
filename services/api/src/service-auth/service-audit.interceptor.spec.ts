import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { lastValueFrom, of, throwError } from "rxjs";
import { ServiceAuditInterceptor } from "./service-audit.interceptor";
import { ServiceAuditService } from "./service-audit.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";

interface AuditedRequest {
  apiClient?: { id: string; name: string };
  body?: unknown;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  method: string;
  originalUrl: string;
}

function anonymousRequest(): AuditedRequest {
  return { query: {}, params: {}, method: "POST", originalUrl: "/v1/issuers" };
}

function request(overrides: Partial<AuditedRequest> = {}): AuditedRequest {
  return { ...anonymousRequest(), apiClient: { id: "client-1", name: "respondi" }, ...overrides };
}

async function createInterceptor(record: jest.Mock): Promise<ServiceAuditInterceptor> {
  return await instantiateWithDoubles(ServiceAuditInterceptor, [
    { token: ServiceAuditService, value: { record } },
  ]);
}

describe("ServiceAuditInterceptor", () => {
  it("records a success with the issuer from the body and the created resource id", async () => {
    const record = jest.fn(() => Promise.resolve());
    const interceptor = await createInterceptor(record);
    const context = new ExecutionContextHost([request({ body: { issuerId: "issuer-body" } })]);

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: "resource-1" }) }));

    expect(record).toHaveBeenCalledWith({
      apiClientId: "client-1",
      issuerId: "issuer-body",
      method: "POST",
      path: "/v1/issuers",
      outcome: "success",
      resourceId: "resource-1",
    });
  });

  it("falls back to the query and then to the route params for the issuer", async () => {
    const record = jest.fn(() => Promise.resolve());
    const interceptor = await createInterceptor(record);
    const fromQuery = new ExecutionContextHost([
      request({ query: { issuerId: "issuer-query" }, params: { issuerId: "issuer-param" } }),
    ]);
    const fromParams = new ExecutionContextHost([request({ params: { issuerId: "issuer-param" } })]);

    await lastValueFrom(interceptor.intercept(fromQuery, { handle: () => of(null) }));
    await lastValueFrom(interceptor.intercept(fromParams, { handle: () => of(null) }));

    expect(record).toHaveBeenNthCalledWith(1, expect.objectContaining({ issuerId: "issuer-query" }));
    expect(record).toHaveBeenNthCalledWith(2, expect.objectContaining({ issuerId: "issuer-param" }));
  });

  it("omits the issuer and the resource when there are none", async () => {
    const record = jest.fn(() => Promise.resolve());
    const interceptor = await createInterceptor(record);
    const context = new ExecutionContextHost([request()]);

    await lastValueFrom(interceptor.intercept(context, { handle: () => of("sin id") }));

    expect(record).toHaveBeenCalledWith({
      apiClientId: "client-1",
      method: "POST",
      path: "/v1/issuers",
      outcome: "success",
    });
  });

  it("records the error message when the handler fails", async () => {
    const record = jest.fn(() => Promise.resolve());
    const interceptor = await createInterceptor(record);
    const context = new ExecutionContextHost([request()]);
    const failing = { handle: () => throwError(() => new Error("ARCA caído")) };

    await expect(lastValueFrom(interceptor.intercept(context, failing))).rejects.toThrow("ARCA caído");

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error", detail: "ARCA caído" }));
  });

  it("does not audit requests without an api client", async () => {
    const record = jest.fn(() => Promise.resolve());
    const interceptor = await createInterceptor(record);
    const context = new ExecutionContextHost([anonymousRequest()]);

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: "resource-1" }) }));

    expect(record).not.toHaveBeenCalled();
  });
});
