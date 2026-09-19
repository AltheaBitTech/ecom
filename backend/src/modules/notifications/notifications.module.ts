import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { InboxService } from './inbox.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  controllers: [NotificationsController],
  providers: [EmailService, SmsService, WhatsAppService, NotificationsService, InboxService],
  // Channel clients are exported so MarketingService can reuse them for broadcasts.
  exports: [NotificationsService, EmailService, SmsService, WhatsAppService],
})
export class NotificationsModule {}
