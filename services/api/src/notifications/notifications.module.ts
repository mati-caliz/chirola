import { Module } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { PushTokensService } from './push-tokens.service';
import { PushTokensController } from './push-tokens.controller';

@Module({
  controllers: [PushTokensController],
  providers: [PushNotificationService, PushTokensService],
  exports: [PushNotificationService],
})
export class NotificationsModule {}
