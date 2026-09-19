import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController],
  imports: [NotificationsModule],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
