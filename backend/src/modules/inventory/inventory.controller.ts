import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_STOCK_VIEW)
  @ApiOperation({ summary: 'List stock levels for the caller\'s tenant', description: `Requires ${PERMISSIONS.INVENTORY_STOCK_VIEW}` })
  list(@CurrentUser() user: AuthContext) {
    return this.inventory.list(user.tenantId);
  }

  @Post(':productId/adjust')
  @RequirePermissions(PERMISSIONS.INVENTORY_STOCK_ADJUST)
  @ApiOperation({
    summary: 'Adjust stock for a product',
    description: `Requires ${PERMISSIONS.INVENTORY_STOCK_ADJUST}. Rejected if it would drive stock negative.`,
  })
  async adjust(@CurrentUser() user: AuthContext, @Param('productId') productId: string, @Body() dto: AdjustStockDto) {
    const item = await this.inventory.adjust(user.tenantId, productId, dto.delta);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'inventory.adjust',
      resourceType: 'InventoryItem',
      resourceId: item.id,
      newValue: { delta: dto.delta, reason: dto.reason, quantityOnHand: item.quantityOnHand },
    });
    return item;
  }
}
