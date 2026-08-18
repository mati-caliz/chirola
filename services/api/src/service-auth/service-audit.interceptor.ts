import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestWithApiClient } from './service-auth.guard';
import { ServiceAuditService } from './service-audit.service';

interface CreatedResource {
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
    const query = req.query as { issuerId?: string };
    const params = req.params as { issuerId?: string };
    const base = {
      apiClientId: apiClient.id,
      issuerId: body.issuerId ?? query.issuerId ?? params.issuerId,
      method: req.method,
      path: req.originalUrl,
    };

    return next.handle().pipe(
      tap({
        next: (result) => {
          const resourceId = (result as CreatedResource | undefined)?.id;
          void this.audit.record({ ...base, outcome: 'success', resourceId });
        },
        error: (err: unknown) => {
          const detail = err instanceof Error ? err.message : String(err);
          void this.audit.record({ ...base, outcome: 'error', detail });
        },
      }),
    );
  }
}
