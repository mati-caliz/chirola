import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyService } from './api-key.service';

export interface AuthenticatedApiClient {
  id: string;
  name: string;
}

@Injectable()
export class ApiClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeys: ApiKeyService,
  ) {}

  async authenticate(rawKey: string): Promise<AuthenticatedApiClient | null> {
    const parsed = this.apiKeys.parse(rawKey);
    if (!parsed) {
      return null;
    }
    const client = await this.prisma.apiClient.findUnique({
      where: { id: parsed.clientId },
    });
    if (!client || !client.active) {
      return null;
    }
    if (!this.apiKeys.verifySecret(parsed.secret, client.keyHash)) {
      return null;
    }
    return { id: client.id, name: client.name };
  }

  async assertIssuerGranted(apiClientId: string, issuerId: string): Promise<void> {
    const grant = await this.prisma.apiClientIssuer.findUnique({
      where: { apiClientId_issuerId: { apiClientId, issuerId } },
    });
    if (!grant) {
      throw new ForbiddenException('El emisor no está habilitado para este cliente.');
    }
  }
}
