import { Module } from '@nestjs/common';
import { CertsService } from './certs.service';
import { CertMonitorService } from './cert-monitor.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [WebhooksModule],
  providers: [CertsService, CertMonitorService],
  exports: [CertsService],
})
export class CertsModule {}
