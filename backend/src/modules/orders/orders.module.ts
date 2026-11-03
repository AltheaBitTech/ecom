import { Module } from '@nestjs/common';

import { ShippingModule } from '../shipping/shipping.module';

import {
  CustomerOrdersController,
  OrdersAdminController,
  StorefrontOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ShippingModule],
  controllers: [StorefrontOrdersController, CustomerOrdersController, OrdersAdminController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
