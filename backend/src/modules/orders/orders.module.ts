import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [InvoicesModule, NotificationsModule],
  controllers: [CustomersController, OrdersController, ReturnsController],
  providers: [CustomersService, OrdersService, ReturnsService],
  exports: [OrdersService, CustomersService],
})
export class OrdersModule {}
