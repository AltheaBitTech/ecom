import { Module } from '@nestjs/common';

import { CustomerAuthService } from './customer-auth.service';
import { CustomerSessionService } from './customer-session.service';
import { CustomerAuthController, CustomerProfileController } from './customers.controller';
import { CustomersService } from './customers.service';

/**
 * Shopper accounts. Owns shopper identity natively (signup/login/tokens via
 * CustomerAuthService against ecom's own Customer table) plus the profile view
 * and address book. Order history for a signed-in shopper lives in OrdersModule's
 * CustomerOrdersController.
 */
@Module({
  controllers: [CustomerAuthController, CustomerProfileController],
  providers: [CustomersService, CustomerAuthService, CustomerSessionService],
  exports: [CustomersService],
})
export class CustomersModule {}
