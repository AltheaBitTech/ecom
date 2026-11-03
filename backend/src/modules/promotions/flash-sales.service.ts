import { Injectable } from '@nestjs/common';
import type { FlashSale, Product } from '@prisma/client';

import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

import type { CreateFlashSaleDto, UpdateFlashSaleDto } from './dto/flash-sales.dto';

type SaleWithProduct = FlashSale & { product: Pick<Product, 'name' | 'stock' | 'currency' | 'priceCents'> };

/** Time-boxed price promotions. Status is derived from the sale window at read
 *  time (never stored), so a sale "expires" without any scheduled job. */
@Injectable()
export class FlashSalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateFlashSaleDto) {
    const starts = new Date(dto.starts_at);
    const ends = new Date(dto.ends_at);
    if (ends <= starts) throw AppException.validation('The sale end must be after its start.');

    const sale = await this.prisma.forTenant(tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: dto.product_id } });
      if (!product) throw AppException.validation('Choose a product from this store.');
      return tx.flashSale.create({
        data: {
          tenantId,
          productId: dto.product_id,
          salePriceCents: dto.sale_price_cents,
          startsAt: starts,
          endsAt: ends,
        },
        include: { product: { select: { name: true, stock: true, currency: true, priceCents: true } } },
      });
    });
    return this.toView(sale);
  }

  async list(tenantId: string) {
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.flashSale.findMany({
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        include: { product: { select: { name: true, stock: true, currency: true, priceCents: true } } },
      }),
    );
    return rows.map((r) => this.toView(r));
  }

  async update(tenantId: string, id: string, dto: UpdateFlashSaleDto) {
    const sale = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.flashSale.findFirst({ where: { id } });
      if (!existing) throw AppException.notFound('Flash sale not found');
      const starts = dto.starts_at ? new Date(dto.starts_at) : existing.startsAt;
      const ends = dto.ends_at ? new Date(dto.ends_at) : existing.endsAt;
      if (ends <= starts) throw AppException.validation('The sale end must be after its start.');
      return tx.flashSale.update({
        where: { id },
        data: { salePriceCents: dto.sale_price_cents, startsAt: starts, endsAt: ends },
        include: { product: { select: { name: true, stock: true, currency: true, priceCents: true } } },
      });
    });
    return this.toView(sale);
  }

  async remove(tenantId: string, id: string): Promise<{ id: string; deleted: true }> {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.flashSale.findFirst({ where: { id } });
      if (!existing) throw AppException.notFound('Flash sale not found');
      await tx.flashSale.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  /** Public storefront read: only sales currently running, minimal fields. */
  async listActive(tenantId: string) {
    const sales = await this.list(tenantId);
    return sales
      .filter((sale) => sale.status === 'ongoing')
      .map(({ product_id, sale_price_cents, ends_at }) => ({ product_id, sale_price_cents, ends_at }));
  }

  /** upcoming | ongoing | expired, derived from the window vs. now. */
  private status(sale: FlashSale): 'upcoming' | 'ongoing' | 'expired' {
    const now = Date.now();
    if (now < sale.startsAt.getTime()) return 'upcoming';
    if (now > sale.endsAt.getTime()) return 'expired';
    return 'ongoing';
  }

  private toView(sale: SaleWithProduct) {
    return {
      id: sale.id,
      tenant_id: sale.tenantId,
      product_id: sale.productId,
      product_name: sale.product.name,
      product_price_cents: sale.product.priceCents,
      stock: sale.product.stock,
      currency: sale.product.currency,
      sale_price_cents: sale.salePriceCents,
      starts_at: sale.startsAt.toISOString(),
      ends_at: sale.endsAt.toISOString(),
      status: this.status(sale),
    };
  }
}
