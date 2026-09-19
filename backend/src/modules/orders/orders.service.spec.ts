import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

const products = [
  { id: 'p1', priceCents: 1000, currency: 'INR', archivedAt: null, name: 'Soap' },
  { id: 'p2', priceCents: 2500, currency: 'INR', archivedAt: null, name: 'Shampoo' },
];

function fakePrisma() {
  return {
    forTenant: () => ({
      customer: { findFirst: async () => ({ id: 'c1' }) },
      product: { findMany: async () => products },
      order: { create: async ({ data }: { data: unknown }) => data },
    }),
  } as never;
}

const fakeNotifications = { notifyOrderStatusChanged: async () => {} } as never;

describe('OrdersService.create — price snapshotting', () => {
  it('computes line and order totals from current product prices', async () => {
    const service = new OrdersService(fakePrisma(), fakeNotifications);
    const order = (await service.create('t1', {
      customerId: 'c1',
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    })) as unknown as { totalCents: number; items: { create: { lineTotalCents: number }[] } };

    expect(order.items.create).toEqual([
      { productId: 'p1', quantity: 2, unitPriceCents: 1000, lineTotalCents: 2000 },
      { productId: 'p2', quantity: 1, unitPriceCents: 2500, lineTotalCents: 2500 },
    ]);
    expect(order.totalCents).toBe(4500);
  });

  it('rejects an order line for an unknown product', async () => {
    const service = new OrdersService(fakePrisma(), fakeNotifications);
    await expect(
      service.create('t1', { customerId: 'c1', items: [{ productId: 'missing', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an order line for an archived product', async () => {
    const archived = { id: 'p3', priceCents: 500, currency: 'INR', archivedAt: new Date(), name: 'Old' };
    const prisma = {
      forTenant: () => ({
        customer: { findFirst: async () => ({ id: 'c1' }) },
        product: { findMany: async () => [archived] },
      }),
    } as never;
    const service = new OrdersService(prisma, fakeNotifications);
    await expect(
      service.create('t1', { customerId: 'c1', items: [{ productId: 'p3', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrdersService.findForCustomer', () => {
  it('returns the order without internal tenant/customer ids, and 404s otherwise', async () => {
    const found = { id: 'o1', tenantId: 't1', customerId: 'c1', status: 'SHIPPED', trackingNumber: 'TRK' };
    const prisma = (row: unknown) => ({ order: { findFirst: async () => row } }) as never;
    const order = await new OrdersService(prisma(found), fakeNotifications).findForCustomer('o1', 'a@b.com');
    expect(order).toEqual({ id: 'o1', status: 'SHIPPED', trackingNumber: 'TRK' });
    await expect(new OrdersService(prisma(null), fakeNotifications).findForCustomer('o1', 'x@y.com')).rejects.toBeInstanceOf(NotFoundException);
  });
});
