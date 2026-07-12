import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiClientService, AuthenticatedApiClient } from './api-client.service';

export type RequestWithApiClient = Request & {
  apiClient: AuthenticatedApiClient;
};

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly apiClients: ApiClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const rawKey = this.extractKey(req);
    if (!rawKey) {
      throw new UnauthorizedException('Falta la API key del servicio.');
    }
    const apiClient = await this.apiClients.authenticate(rawKey);
    if (!apiClient) {
      throw new UnauthorizedException('API key inválida.');
    }
    (req as RequestWithApiClient).apiClient = apiClient;
    return true;
  }

  private extractKey(req: Request): string | null {
    const apiKeyHeader = req.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
      return apiKeyHeader;
    }
    const authorization = req.headers.authorization ?? '';
    const [scheme, token] = authorization.split(' ');
    if (scheme === 'Bearer' && token) {
      return token;
    }
    return null;
  }
}
