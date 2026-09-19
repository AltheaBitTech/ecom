import { ConflictException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryService } from './inventory.service';

function fakePrisma(item: { id: string; quantityOnHand: number }) {
  return {
    forTenant: () => ({
      inventoryItem: {
        findFirst: async () => item,
        update: async ({ data }: { data: { quantityOnHand: { increment: number } } }) => {
          item.quantityOnHand += data.quantityOnHand.increment;
          return item;
        },
      },
    }),
  } as never;
}

const notifications = { notifyStockChanges: async () => undefined } as never;

describe('InventoryService.adjust', () => {
  it('rejects an adjustment that would drive stock negative', async () => {
    const service = new InventoryService(fakePrisma({ id: 'i1', quantityOnHand: 5 }), notifications);
    await expect(service.adjust('t1', 'p1', -10)).rejects.toBeInstanceOf(ConflictException);
  });

  it('applies a valid negative delta', async () => {
    const service = new InventoryService(fakePrisma({ id: 'i1', quantityOnHand: 5 }), notifications);
    const updated = await service.adjust('t1', 'p1', -3);
    expect(updated.quantityOnHand).toBe(2);
  });

  it('applies a positive delta (restock)', async () => {
    const service = new InventoryService(fakePrisma({ id: 'i1', quantityOnHand: 5 }), notifications);
    const updated = await service.adjust('t1', 'p1', 10);
    expect(updated.quantityOnHand).toBe(15);
  });

  it('404s when no inventory record exists for the product', async () => {
    const prisma = { forTenant: () => ({ inventoryItem: { findFirst: async () => null } }) } as never;
    const service = new InventoryService(prisma, notifications);
    await expect(service.adjust('t1', 'missing', 1)).rejects.toThrow('Inventory record not found for this product');
  });

  it('rejects a missing reason on the DTO', async () => {
    const dto = plainToInstance(AdjustStockDto, { delta: -1, reason: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});
