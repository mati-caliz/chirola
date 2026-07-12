import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { IssuersModule } from '../issuers/issuers.module';

@Module({
  imports: [IssuersModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
