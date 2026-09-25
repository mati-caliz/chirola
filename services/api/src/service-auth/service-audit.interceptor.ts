import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { RequestMaybeWithApiClient } from "./service-auth.guard";
import { ServiceAuditService } from "./service-audit.service";
import { optionalField } from "../common/optional-field";

function readStringField(source: unknown, field: string): string | undefined {
  if (typeof source !== "object" || source === null) return undefined;
  const value: unknown = Reflect.get(source, field);
  return typeof value === "string" ? value : undefined;
}

@Injectable()
export class ServiceAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: ServiceAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestMaybeWithApiClient>();
    const apiClient = req.apiClient;
    if (apiClient === undefined) {
      return next.handle();
    }

    const requestBody: unknown = req.body;
    const issuerId =
      readStringField(requestBody, "issuerId") ??
      readStringField(req.query, "issuerId") ??
      readStringField(req.params, "issuerId");
    const base = {
      apiClientId: apiClient.id,
      ...optionalField("issuerId", issuerId),
      method: req.method,
      path: req.originalUrl,
    };

    return next.handle().pipe(
      tap({
        next: (result: unknown) => {
          const resourceId = readStringField(result, "id");
          void this.audit.record({ ...base, outcome: "success", ...optionalField("resourceId", resourceId) });
        },
        error: (err: unknown) => {
          const detail = err instanceof Error ? err.message : String(err);
          void this.audit.record({ ...base, outcome: "error", detail });
        },
      }),
    );
  }
}
