import { Module } from '@nestjs/common';

import { CarrierRegistry } from './carriers/carrier.registry';
import { ManualShippingCarrier } from './carriers/manual.carrier';
import { ShipmojoCarrier } from './carriers/shipmojo.carrier';
import { ShiprocketCarrier } from './carriers/shiprocket.carrier';
import { ShippingAdminController, StorefrontShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

/**
 * Shipping. Carriers are plain providers resolved by the registry, so a new
 * carrier is added by registering its adapter here. Exports ShippingService so
 * OrdersModule can price shipping into checkout — a one-way dependency
 * (orders -> shipping); shipping reads orders through Prisma, never OrdersService,
 * so there is no cycle.
 */
@Module({
  controllers: [StorefrontShippingController, ShippingAdminController],
  providers: [ShippingService, CarrierRegistry, ShiprocketCarrier, ShipmojoCarrier, ManualShippingCarrier],
  exports: [ShippingService],
})
export class ShippingModule {}
