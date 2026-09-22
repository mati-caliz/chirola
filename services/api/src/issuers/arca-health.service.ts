import { Injectable, Logger } from '@nestjs/common';
import type { ArcaHealth } from '@chirola/shared';
import { WsfeService, type ArcaServerStatus } from '../arca/wsfe/wsfe.service';

const HEALTH_CACHE_TTL_MS = 60_000;

const UNREACHABLE: ArcaServerStatus = {
  appServer: false,
  dbServer: false,
  authServer: false,
};

interface CachedHealth {
  health: ArcaHealth;
  expiresAt: number;
}

@Injectable()
export class ArcaHealthService {
  private readonly logger = new Logger(ArcaHealthService.name);
  private readonly cache = new Map<string, CachedHealth>();

  constructor(private readonly wsfe: WsfeService) {}

  async check(environment: string): Promise<ArcaHealth> {
    const cached = this.cache.get(environment);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.health;
    }
    const servers = await this.fetchServers(environment);
    const health: ArcaHealth = {
      environment,
      ...servers,
      available: servers.appServer && servers.dbServer && servers.authServer,
      checkedAt: new Date().toISOString(),
    };
    this.cache.set(environment, { health, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS });
    return health;
  }

  private async fetchServers(environment: string): Promise<ArcaServerStatus> {
    try {
      return await this.wsfe.checkServers(environment);
    } catch (err) {
      this.logger.warn(
        `ARCA no respondió el FEDummy (${environment}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return UNREACHABLE;
    }
  }
}
