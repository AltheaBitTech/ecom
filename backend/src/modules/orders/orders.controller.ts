import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth, CurrentPrincipal, OptionalAuth, Public, RequirePermission } from '../../common/auth/decorators';
import { isCustomer, isStaff, type Principal } from '../../common/auth/principal';
import { AppException } from '../../common/errors/app-exception';

import {
  CheckoutDto,
  ListOrdersQueryDto,
  PreviewCartDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';
import { OrdersService } from './orders.service';

/**
 * Storefront checkout & order tracking. Checkout and preview are optional-auth:
 * a shopper's customer token attributes the order, its absence means a guest.
 * RLS scopes everything to the store.
 */
@ApiTags('storefront-orders')
@Controller('storefront/:tenantId')
export class StorefrontOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('cart/preview')
  @Public()
  @HttpCode(200)
  preview(@Param('tenantId') tenantId: string, @Body() dto: PreviewCartDto) {
    return this.orders.preview(tenantId, dto.items);
  }

  @Post('checkout')
  @OptionalAuth('customer')
  checkout(
    @Param('tenantId') tenantId: string,
    @Body() dto: CheckoutDto,
    @CurrentPrincipal() principal: Principal | undefined,
  ) {
    return this.orders.checkout(tenantId, dto, principal);
  }

  @Get('orders/:id')
  @OptionalAuth('customer')
  getOrder(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal | undefined,
    @Query('email') email?: string,
  ) {
    return this.orders.getForShopper(tenantId, id, principal, email);
  }
}

/** A signed-in shopper's own order history. */
@ApiTags('storefront-account')
@Controller('storefront/:tenantId/account')
@Auth('customer')
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders')
  listMyOrders(
    @Param('tenantId') tenantId: string,
    @CurrentPrincipal() principal: Principal,
    @Query() query: ListOrdersQueryDto,
  ) {
    if (!isCustomer(principal)) throw AppException.permissionDenied();
    return this.orders.listForCustomer(tenantId, principal.customerId, query);
  }
}

/** Admin order management — staff, gated by orders:* permissions. */
@ApiTags('orders-admin')
@Controller('tenants/:tenantId/orders')
@Auth('staff', 'internal')
export class OrdersAdminController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission('orders:read')
  list(@Param('tenantId') tenantId: string, @Query() query: ListOrdersQueryDto) {
    return this.orders.listAdmin(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('orders:read')
  get(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.orders.getAdmin(tenantId, id);
  }

  @Patch(':id/status')
  @RequirePermission('orders:write')
  updateStatus(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    const actor = isStaff(principal) ? principal.userId : 'internal';
    return this.orders.updateStatus(tenantId, id, dto.status, actor);
  }
}
