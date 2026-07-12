import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiClientService } from './api-client.service';
import { ServiceAuthGuard } from './service-auth.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { ServiceAuditService } from './service-audit.service';
import { ServiceAuditInterceptor } from './service-audit.interceptor';

@Module({
  providers: [
    ApiKeyService,
    ApiClientService,
    ServiceAuthGuard,
    RateLimitGuard,
    ServiceAuditService,
    ServiceAuditInterceptor,
  ],
  exports: [
    ApiKeyService,
    ApiClientService,
    ServiceAuthGuard,
    RateLimitGuard,
    ServiceAuditService,
    ServiceAuditInterceptor,
  ],
})
export class ServiceAuthModule {}
