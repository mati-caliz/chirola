import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { ArcaModule } from './arca/arca.module';
import { CertsModule } from './certs/certs.module';
import { IssuersModule } from './issuers/issuers.module';
import { ClientsModule } from './clients/clients.module';
import { TaxpayersModule } from './taxpayers/taxpayers.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { PurchaseInvoicesModule } from './purchase-invoices/purchase-invoices.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { ShadowModule } from './shadow/shadow.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    AuthModule,
    ArcaModule,
    CertsModule,
    IssuersModule,
    ClientsModule,
    TaxpayersModule,
    VouchersModule,
    PurchaseInvoicesModule,
    FiscalModule,
    ShadowModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
