import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { ArcaModule } from './arca/arca.module';
import { CertsModule } from './certs/certs.module';
import { EmisoresModule } from './emisores/emisores.module';
import { ClientesModule } from './clientes/clientes.module';
import { ComprobantesModule } from './comprobantes/comprobantes.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    ArcaModule,
    CertsModule,
    EmisoresModule,
    ClientesModule,
    ComprobantesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
