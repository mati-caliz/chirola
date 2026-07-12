import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiClientService } from './api-client.service';
import { ServiceAuthGuard } from './service-auth.guard';

@Module({
  providers: [ApiKeyService, ApiClientService, ServiceAuthGuard],
  exports: [ApiKeyService, ApiClientService, ServiceAuthGuard],
})
export class ServiceAuthModule {}
