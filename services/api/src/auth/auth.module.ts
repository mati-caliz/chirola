import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CredentialsRateLimitGuard, RefreshRateLimitGuard } from './auth-rate-limit.guards';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),

        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL', '1h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, CredentialsRateLimitGuard, RefreshRateLimitGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
