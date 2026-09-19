import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { ListOrdersDto } from './dto/list-orders.dto';

const ORDER_INCLUDE = {
  items: { include: { product: true, variant: true } },
  customer: true,
  payment: true,
  events: { orderBy: { createdAt: 'asc' } },
  invoice: true,
  returns: { orderBy: { createdAt: 'desc' } },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(tenantId: string, query: ListOrdersDto = {}) {
    const { status, from, to, search, sortBy = 'createdAt', sortDir = 'desc' } = query;
    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
      ...(search
        ? {
            customer: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    return this.prisma.forTenant(tenantId).order.findMany({ where, include: ORDER_INCLUDE, orderBy: { [sortBy]: sortDir } });
  }

  async findOne(tenantId: string, orderId: string) {
    const order = await this.prisma.forTenant(tenantId).order.findFirst({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Snapshots each line's current product price at order time — price changes later never alter a placed order. */
  async create(tenantId: string, dto: CreateOrderDto) {
    const scoped = this.prisma.forTenant(tenantId);
    const customer = await scoped.customer.findFirst({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await scoped.product.findMany({ where: { id: { in: productIds } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const variantIds = [...new Set(dto.items.map((i) => i.variantId).filter((id): id is string => !!id))];
    const variants = variantIds.length
      ? await scoped.productVariant.findMany({ where: { id: { in: variantIds } } })
      : [];
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const lines = dto.items.map((line) => {
      const product = byId.get(line.productId);
      if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
      if (product.archivedAt) throw new BadRequestException(`Product ${product.name} is archived`);

      let unitPriceCents = product.priceCents;
      let variantId: string | undefined;
      let variantLabel: string | undefined;
      if (line.variantId) {
        const variant = variantById.get(line.variantId);
        if (!variant || variant.productId !== product.id) {
          throw new NotFoundException(`Variant ${line.variantId} not found for product ${product.name}`);
        }
        if (variant.archivedAt) throw new BadRequestException(`Variant "${variant.label}" is archived`);
        unitPriceCents = variant.priceCents;
        variantId = variant.id;
        variantLabel = variant.label;
      }

      const lineTotalCents = unitPriceCents * line.quantity;
      return {
        productId: product.id,
        variantId,
        variantLabel,
        quantity: line.quantity,
        unitPriceCents,
        lineTotalCents,
        // ponytail: kept only to compute the order-level tax total below — OrderItem has no
        // taxCents column, so it's stripped before the nested create.
        gstRateBps: product.gstRateBps ?? 0,
      };
    });
    const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    const taxCents = lines.reduce((sum, l) => sum + Math.round((l.lineTotalCents * l.gstRateBps) / 10000), 0);
    const totalCents = subtotalCents + taxCents;
    const currency = products[0]?.currency ?? 'INR';

    const order = await scoped.order.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        subtotalCents,
        taxCents,
        totalCents,
        currency,
        items: { create: lines.map(({ gstRateBps: _gstRateBps, ...l }) => l) },
        events: { create: { status: 'PENDING' } },
      },
      include: ORDER_INCLUDE,
    });
    void this.notifications.notifyOrderStatusChanged(order, 'PENDING');
    return order;
  }

  /**
   * PENDING -> CONFIRMED, decrementing stock for every line inside one transaction so a
   * shortage on any line aborts the whole confirmation rather than leaving stock half-deducted.
   */
  async confirm(tenantId: string, orderId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    return scoped.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'PENDING') throw new ConflictException('Only pending orders can be confirmed');

      const stock: { productId: string; before: number; after: number; threshold: number }[] = [];
      for (const item of order.items) {
        const inv = await tx.inventoryItem.findFirst({ where: { productId: item.productId } });
        if (!inv || inv.quantityOnHand < item.quantity) {
          throw new ConflictException(`Insufficient stock for product ${item.productId}`);
        }
        await tx.inventoryItem.update({ where: { id: inv.id }, data: { quantityOnHand: { decrement: item.quantity } } });
        stock.push({ productId: item.productId, before: inv.quantityOnHand, after: inv.quantityOnHand - item.quantity, threshold: inv.reorderThreshold });
      }

      await tx.orderEvent.create({ data: { orderId, status: 'CONFIRMED' } });
      const confirmed = await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' }, include: ORDER_INCLUDE });
      return { confirmed, stock };
    }).then(({ confirmed, stock }) => {
      void this.notifications.notifyOrderStatusChanged(confirmed, 'CONFIRMED');
      void this.notifications.notifyStockChanges(tenantId, stock); // only after the transaction committed
      return confirmed;
    });
  }

  async ship(tenantId: string, orderId: string, trackingNumber?: string, courierName?: string) {
    const scoped = this.prisma.forTenant(tenantId);
    return scoped.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'CONFIRMED') throw new ConflictException('Only confirmed orders can be marked shipped');

      await tx.orderEvent.create({
        data: { orderId, status: 'SHIPPED', note: trackingNumber ? `Tracking: ${trackingNumber}${courierName ? ` (${courierName})` : ''}` : null },
      });
      return tx.order.update({
        where: { id: orderId },
        data: { status: 'SHIPPED', trackingNumber: trackingNumber || null, courierName: courierName || null },
        include: ORDER_INCLUDE,
      });
    }).then((order) => {
      void this.notifications.notifyOrderStatusChanged(order, 'SHIPPED', trackingNumber ? `Tracking: ${trackingNumber}${courierName ? ` (${courierName})` : ''}` : null);
      return order;
    });
  }

  async fulfill(tenantId: string, orderId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    return scoped.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'SHIPPED') throw new ConflictException('Only shipped orders can be fulfilled');

      await tx.orderEvent.create({ data: { orderId, status: 'FULFILLED' } });
      return tx.order.update({ where: { id: orderId }, data: { status: 'FULFILLED' }, include: ORDER_INCLUDE });
    }).then((order) => {
      void this.notifications.notifyOrderStatusChanged(order, 'FULFILLED');
      return order;
    });
  }

  /**
   * Cancelling a confirmed or shipped order restocks every line; a pending order never touched
   * stock. The reason is recorded on the status event and travels to the customer's
   * notification — "cancelled" with no explanation is the worst version of this message.
   */
  async cancel(tenantId: string, orderId: string, reason?: string) {
    const scoped = this.prisma.forTenant(tenantId);
    return scoped.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'FULFILLED' || order.status === 'CANCELLED') {
        throw new ConflictException(`Order already ${order.status.toLowerCase()}`);
      }

      if (order.status === 'CONFIRMED' || order.status === 'SHIPPED') {
        for (const item of order.items) {
          await tx.inventoryItem.updateMany({
            where: { productId: item.productId },
            data: { quantityOnHand: { increment: item.quantity } },
          });
        }
      }

      await tx.orderEvent.create({ data: { orderId, status: 'CANCELLED', note: reason || null } });
      return tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' }, include: ORDER_INCLUDE });
    }).then((order) => {
      void this.notifications.notifyOrderStatusChanged(order, 'CANCELLED', reason ? `Reason: ${reason}` : null);
      void this.notifications.notifyAdmin(tenantId, `Order cancelled: ${orderId.slice(0, 8).toUpperCase()}`, `Order for ${order.customer.name} was cancelled.${reason ? ` Reason: ${reason}` : ''} Any deducted stock has been returned.`, { link: `/admin/orders/${orderId}` });
      return order;
    });
  }

  /**
   * Customer-facing lookup: no tenant scoping needed because Order.id is a globally-unique
   * UUID primary key (not partitioned per tenant) and matching it against the customer's own
   * email is enough to prove ownership — same trust model as the review-eligibility check in
   * the storefront module.
   */
  async findForCustomer(orderId: string, email: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customer: { email: { equals: email, mode: 'insensitive' } } },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    // Unauthenticated response: don't hand out internal tenant/customer ids.
    const { tenantId: _tenantId, customerId: _customerId, ...publicOrder } = order;
    return publicOrder;
  }

  /** CSV export honoring the same filters as list(). One row per order (not per line item). */
  async exportCsv(tenantId: string, query: ListOrdersDto = {}): Promise<string> {
    const orders = await this.list(tenantId, query);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Order ID', 'Customer', 'Email', 'Status', 'Total', 'Currency', 'Tracking', 'Courier', 'Placed'];
    const rows = orders.map((o) => [
      o.id,
      o.customer.name,
      o.customer.email ?? '',
      o.status,
      (o.totalCents / 100).toFixed(2),
      o.currency,
      o.trackingNumber ?? '',
      o.courierName ?? '',
      o.createdAt.toISOString(),
    ]);
    return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  }
}
