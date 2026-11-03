import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';

import { PaymentGatewayRegistry } from './gateways/gateway.registry';
import { ManualGateway } from './gateways/manual.gateway';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { PaymentsAdminController, StorefrontPaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/**
 * Payments. Depends on OrdersModule for the shopper-ownership check and the order
 * state machine. Gateways are plain providers resolved by the registry, so a new
 * provider is added by registering its adapter here.
 */
@Module({
  imports: [OrdersModule],
  controllers: [StorefrontPaymentsController, PaymentsAdminController],
  providers: [PaymentsService, PaymentGatewayRegistry, RazorpayGateway, ManualGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
