import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth, CurrentPrincipal, Public, RequirePermission } from '../../common/auth/decorators';
import { isStaff, type Principal } from '../../common/auth/principal';

import { QuoteRatesDto, UpsertShippingAccountDto } from './dto/shipping.dto';
import { ShippingService } from './shipping.service';

/** Storefront: quote shipping options for a cart before checkout. Open to all. */
@ApiTags('storefront-shipping')
@Controller('storefront/:tenantId/shipping')
export class StorefrontShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Post('rates')
  @Public()
  @HttpCode(200)
  rates(@Param('tenantId') tenantId: string, @Body() dto: QuoteRatesDto) {
    return this.shipping.quoteForCart(
      tenantId,
      dto.items,
      { postalCode: dto.destination.postal_code, country: dto.destination.country },
      dto.cod ?? false,
    );
  }
}

/** Admin: connect a carrier + fulfil orders. Gated by store_settings / orders perms. */
@ApiTags('shipping-admin')
@Controller('tenants/:tenantId')
@Auth('staff', 'internal')
export class ShippingAdminController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('shipping-account')
  @RequirePermission('store_settings:read')
  getAccount(@Param('tenantId') tenantId: string) {
    return this.shipping.getAccount(tenantId);
  }

  @Put('shipping-account')
  @RequirePermission('store_settings:write')
  upsertAccount(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertShippingAccountDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    const actor = isStaff(principal) ? principal.userId : 'internal';
    return this.shipping.upsertAccount(tenantId, dto, actor);
  }

  @Post('orders/:id/shipment')
  @RequirePermission('orders:write')
  createShipment(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    const actor = isStaff(principal) ? principal.userId : 'internal';
    return this.shipping.createShipment(tenantId, id, actor);
  }

  @Get('orders/:id/shipment/track')
  @RequirePermission('orders:read')
  track(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.shipping.track(tenantId, id);
  }
}
