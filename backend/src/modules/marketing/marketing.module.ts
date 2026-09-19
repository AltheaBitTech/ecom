import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
