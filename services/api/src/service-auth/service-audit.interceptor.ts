import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestWithApiClient } from './service-auth.guard';
import { ServiceAuditService } from './service-audit.service';

interface IssuedResult {
  id?: string;
}

@Injectable()
export class ServiceAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: ServiceAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithApiClient>();
    const apiClient = req.apiClient;
    if (!apiClient) {
      return next.handle();
    }

    const body = (req.body ?? {}) as { issuerId?: string };
    const base = {
      apiClientId: apiClient.id,
      issuerId: body.issuerId,
      method: req.method,
      path: req.originalUrl,
    };

    return next.handle().pipe(
      tap({
        next: (result) => {
          const voucherId = (result as IssuedResult | undefined)?.id;
          void this.audit.record({ ...base, outcome: 'success', voucherId });
        },
        error: (err: unknown) => {
          const detail = err instanceof Error ? err.message : String(err);
          void this.audit.record({ ...base, outcome: 'error', detail });
        },
      }),
    );
  }
}
