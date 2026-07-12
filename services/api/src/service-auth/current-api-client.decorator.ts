import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithApiClient } from './service-auth.guard';
import type { AuthenticatedApiClient } from './api-client.service';

export const CurrentApiClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedApiClient => {
    const req = ctx.switchToHttp().getRequest<RequestWithApiClient>();
    return req.apiClient;
  },
);
