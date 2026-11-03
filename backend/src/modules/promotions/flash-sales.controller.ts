import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth, Public, RequirePermission } from '../../common/auth/decorators';

import { CreateFlashSaleDto, UpdateFlashSaleDto } from './dto/flash-sales.dto';
import { FlashSalesService } from './flash-sales.service';

/** Public storefront read — powers a "deal countdown" section. No credential. */
@ApiTags('flash-sales-storefront')
@Controller('storefront/:tenantId/flash-sales')
export class FlashSalesStorefrontController {
  constructor(private readonly sales: FlashSalesService) {}

  @Get('active')
  @Public()
  listActive(@Param('tenantId') tenantId: string) {
    return this.sales.listActive(tenantId);
  }
}

/** Admin flash-sale management — staff, gated by promotions:* permissions. */
@ApiTags('flash-sales-admin')
@Controller('tenants/:tenantId/flash-sales')
@Auth('staff', 'internal')
export class FlashSalesAdminController {
  constructor(private readonly sales: FlashSalesService) {}

  @Get()
  @RequirePermission('promotions:read')
  list(@Param('tenantId') tenantId: string) {
    return this.sales.list(tenantId);
  }

  @Post()
  @RequirePermission('promotions:write')
  create(@Param('tenantId') tenantId: string, @Body() dto: CreateFlashSaleDto) {
    return this.sales.create(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('promotions:write')
  update(@Param('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateFlashSaleDto) {
    return this.sales.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('promotions:write')
  remove(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.sales.remove(tenantId, id);
  }
}
