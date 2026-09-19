import { BadRequestException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

// Minimal fake standing in for PrismaService.forTenant(tenantId) — enough surface
// for the lifecycle logic under test, not a full DB.
function fakePrisma(product: Record<string, unknown>) {
  return {
    forTenant: () => ({
      product: {
        findFirst: async () => product,
        update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(product, data),
      },
    }),
  } as never;
}

describe('CatalogService — publish/archive lifecycle', () => {
  it('rejects publish when required fields are missing', async () => {
    const service = new CatalogService(fakePrisma({ id: 'p1', name: '', sku: 'SKU1', priceCents: 0, publishedAt: null, archivedAt: null }));
    await expect(service.publish('t1', 'p1')).rejects.toThrow(BadRequestException);
    await expect(service.publish('t1', 'p1')).rejects.toThrow(/name.*priceCents|name, priceCents/);
  });

  it('publishes successfully and sets publishedAt', async () => {
    const product = { id: 'p1', name: 'Soap', sku: 'SKU1', priceCents: 999, publishedAt: null, archivedAt: null };
    const service = new CatalogService(fakePrisma(product));
    const updated = await service.publish('t1', 'p1');
    expect(updated.publishedAt).toBeInstanceOf(Date);
  });

  it('archives regardless of publish state', async () => {
    const product = { id: 'p1', name: 'Soap', sku: 'SKU1', priceCents: 999, publishedAt: new Date(), archivedAt: null };
    const service = new CatalogService(fakePrisma(product));
    const updated = await service.archive('t1', 'p1');
    expect(updated.archivedAt).toBeInstanceOf(Date);
  });
});
