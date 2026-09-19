import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// ponytail: one InventoryItem per product (single warehouse). Multi-warehouse support
// (a location dimension, transfers between locations) is real scope from the spec but
// has no consumer yet — add a `warehouseId` column and a composite unique key when there's
// a second warehouse to actually track.
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(tenantId: string) {
    return this.prisma.forTenant(tenantId).inventoryItem.findMany({
      include: { product: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Applies a signed delta to a product's stock. Not fully race-safe under concurrent
   * adjustments (read-then-write, not a single atomic conditional update) — acceptable at
   * today's write volume; upgrade path is a conditional `updateMany` keyed on the
   * pre-read quantity, or a DB check constraint, if concurrent adjusters become real.
   */
  async adjust(tenantId: string, productId: string, delta: number) {
    const scoped = this.prisma.forTenant(tenantId);
    const item = await scoped.inventoryItem.findFirst({ where: { productId } });
    if (!item) throw new NotFoundException('Inventory record not found for this product');
    if (item.quantityOnHand + delta < 0) {
      throw new ConflictException('Adjustment would result in negative stock');
    }
    const updated = await scoped.inventoryItem.update({
      where: { id: item.id },
      data: { quantityOnHand: { increment: delta } },
      include: { product: true },
    });
    void this.notifications.notifyStockChanges(tenantId, [
      { productId, before: item.quantityOnHand, after: updated.quantityOnHand, threshold: updated.reorderThreshold },
    ]);
    return updated;
  }
}
