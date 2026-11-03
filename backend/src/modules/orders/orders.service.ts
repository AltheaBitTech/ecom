import { randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { AuditService } from '../../common/audit/audit.service';
import type { Principal } from '../../common/auth/principal';
import { isCustomer } from '../../common/auth/principal';
import { AppException } from '../../common/errors/app-exception';
import { buildPage, decodeCursor, type Page } from '../../common/http/pagination';
import { PrismaService, type Tx } from '../../common/prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';

import type { CheckoutDto, CheckoutItemDto, ListOrdersQueryDto } from './dto/orders.dto';

interface PricedLine {
  product_id: string;
  name: string;
  price_cents: number;
  quantity: number;
  line_total_cents: number;
}

export interface CartQuote {
  currency: string;
  lines: PricedLine[];
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
}

/** Only these status transitions are allowed (staff- or payment-driven). */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.FULFILLED, OrderStatus.REFUNDED, OrderStatus.CANCELLED],
  FULFILLED: [OrderStatus.REFUNDED],
  CANCELLED: [],
  REFUNDED: [],
};

/** Whether an order may move `from` -> `to`. Shared with the payment flow. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * Orders & checkout. Every price and total is computed from the database, never
 * from the client — the request only names products and quantities. Stock is
 * decremented atomically with a conditional update so concurrent checkouts can
 * never oversell. All work runs under the tenant RLS context.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly shipping: ShippingService,
  ) {}

  /** Price a cart without persisting anything (storefront cart/summary view). */
  async preview(tenantId: string, items: CheckoutItemDto[]): Promise<CartQuote> {
    return this.prisma.forTenant(tenantId, (tx) => this.priceCart(tx, tenantId, items, 0));
  }

  /**
   * Create a PENDING order from a validated cart. Attributed to the signed-in
   * customer when present, otherwise a guest identified by email. Payment is a
   * separate step (the order starts unpaid); stock is reserved now.
   */
  async checkout(tenantId: string, dto: CheckoutDto, principal?: Principal): Promise<OrderView> {
    const customerId = principal && isCustomer(principal) ? principal.customerId : null;
    if (!customerId && !dto.email) {
      throw AppException.validation('email is required for guest checkout');
    }

    // Quote shipping BEFORE opening the reservation transaction — the carrier call
    // may hit the network and must not hold a row lock. The client's chosen
    // service is re-validated here; the cost is server-authoritative.
    const chosenRate = await this.shipping.quoteForCheckout(
      tenantId,
      dto.items,
      { postalCode: dto.shipping_address.postal_code, country: dto.shipping_address.country },
      dto.shipping_service,
    );

    const order = await this.prisma.forTenant(tenantId, async (tx) => {
      const quote = await this.priceCart(tx, tenantId, dto.items, chosenRate.amount_cents);

      // Reserve stock atomically. A conditional decrement fails (count 0) if the
      // row lacks the quantity or is no longer purchasable — no overselling.
      for (const line of quote.lines) {
        const reserved = await tx.product.updateMany({
          where: { id: line.product_id, deletedAt: null, status: 'ACTIVE', stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (reserved.count !== 1) {
          throw AppException.conflict('out_of_stock', `"${line.name}" does not have enough stock`);
        }
      }

      const created = await tx.order.create({
        data: {
          tenantId,
          number: await this.nextOrderNumber(tx, tenantId),
          status: OrderStatus.PENDING,
          customerId,
          guestEmail: customerId ? null : (dto.email ?? null),
          subtotalCents: quote.subtotal_cents,
          shippingCents: quote.shipping_cents,
          totalCents: quote.total_cents,
          currency: quote.currency,
          shippingAddress: dto.shipping_address as unknown as Prisma.InputJsonValue,
          metadata: {
            note: dto.note ?? null,
            shipping_service: chosenRate.service,
            shipping_label: chosenRate.label,
          } as Prisma.InputJsonValue,
          items: {
            create: quote.lines.map((l) => ({
              tenantId,
              productId: l.product_id,
              nameSnapshot: l.name,
              priceCents: l.price_cents,
              quantity: l.quantity,
            })),
          },
        },
        include: { items: true },
      });
      return created;
    });

    await this.audit.record({
      tenantId,
      actorKind: customerId ? 'customer' : 'system',
      actorId: customerId,
      action: 'order.created',
      target: order.id,
      method: 'POST',
      route: '/storefront/:tenantId/checkout',
      statusCode: 201,
      metadata: { number: order.number, total_cents: order.totalCents },
    });

    return toOrderView(order);
  }

  /**
   * Fetch an order for a shopper. A signed-in customer must own it; a guest must
   * supply the email the order was placed with. Prevents enumerating others'
   * orders even though ids are unguessable.
   */
  async getForShopper(
    tenantId: string,
    orderId: string,
    principal?: Principal,
    email?: string,
  ): Promise<OrderView> {
    const order = await this.prisma.forTenant(tenantId, (tx) =>
      tx.order.findFirst({ where: { id: orderId }, include: { items: true } }),
    );
    if (!order) throw AppException.notFound('Order not found');

    if (principal && isCustomer(principal)) {
      if (order.customerId !== principal.customerId) throw AppException.notFound('Order not found');
    } else {
      const supplied = email?.toLowerCase();
      if (!order.guestEmail || !supplied || order.guestEmail.toLowerCase() !== supplied) {
        throw AppException.notFound('Order not found');
      }
    }
    return toOrderView(order);
  }

  /** A customer's own order history. */
  async listForCustomer(
    tenantId: string,
    customerId: string,
    query: ListOrdersQueryDto,
  ): Promise<Page<unknown>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.order.findMany({
        where: { customerId, ...(cursor ? { id: { gt: cursor } } : {}) },
        include: { items: true },
        orderBy: { id: 'asc' },
        take: query.limit + 1,
      }),
    );
    return buildPage(rows, query.limit, toOrderView);
  }

  // --- Admin -----------------------------------------------------------------
  async listAdmin(tenantId: string, query: ListOrdersQueryDto): Promise<Page<unknown>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.order.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        include: { items: true },
        orderBy: { id: 'asc' },
        take: query.limit + 1,
      }),
    );
    return buildPage(rows, query.limit, toOrderView);
  }

  async getAdmin(tenantId: string, orderId: string): Promise<OrderView> {
    const order = await this.prisma.forTenant(tenantId, (tx) =>
      tx.order.findFirst({ where: { id: orderId }, include: { items: true } }),
    );
    if (!order) throw AppException.notFound('Order not found');
    return toOrderView(order);
  }

  /**
   * Move an order through its lifecycle, enforcing the allowed transitions.
   * Cancelling/refunding an order that reserved stock returns it to inventory.
   */
  async updateStatus(
    tenantId: string,
    orderId: string,
    next: OrderStatus,
    actorUserId: string,
  ): Promise<OrderView> {
    const updated = await this.prisma.forTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId }, include: { items: true } });
      if (!order) throw AppException.notFound('Order not found');
      if (order.status === next) return order;
      if (!TRANSITIONS[order.status].includes(next)) {
        throw AppException.validation(`Cannot move an order from ${order.status} to ${next}`);
      }

      const returnsStock = next === OrderStatus.CANCELLED || next === OrderStatus.REFUNDED;
      if (returnsStock) {
        for (const item of order.items) {
          if (!item.productId) continue;
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: { status: next },
        include: { items: true },
      });
    });

    await this.audit.record({
      tenantId,
      actorKind: 'staff',
      actorId: actorUserId,
      action: 'order.status_changed',
      target: orderId,
      method: 'PATCH',
      route: '/tenants/:tenantId/orders/:id/status',
      statusCode: 200,
      metadata: { status: next },
    });
    return toOrderView(updated);
  }

  // --- Internals -------------------------------------------------------------
  /**
   * Re-price a cart from the DB. Validates each product is purchasable, snapshots
   * its current price, and sums the totals. `shippingCents` is added by the
   * shipping step; 0 here.
   */
  private async priceCart(
    tx: Tx,
    tenantId: string,
    items: CheckoutItemDto[],
    shippingCents: number,
  ): Promise<CartQuote> {
    if (items.length === 0) throw AppException.validation('The cart is empty');

    // Collapse duplicate product ids into summed quantities.
    const quantities = new Map<string, number>();
    for (const item of items) {
      quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
    }

    const products = await tx.product.findMany({
      where: { id: { in: [...quantities.keys()] }, deletedAt: null, status: 'ACTIVE' },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const settings = await tx.tenantSettings.findUnique({ where: { tenantId } });
    const currency = settings?.currency ?? products[0]?.currency ?? 'INR';

    const lines: PricedLine[] = [];
    for (const [productId, quantity] of quantities) {
      const product = byId.get(productId);
      if (!product) throw AppException.validation(`Product ${productId} is unavailable`);
      lines.push({
        product_id: product.id,
        name: product.name,
        price_cents: product.priceCents,
        quantity,
        line_total_cents: product.priceCents * quantity,
      });
    }

    const subtotal = lines.reduce((sum, l) => sum + l.line_total_cents, 0);
    return {
      currency,
      lines,
      subtotal_cents: subtotal,
      shipping_cents: shippingCents,
      total_cents: subtotal + shippingCents,
    };
  }

  /** A human-facing order number unique within the tenant. Retries on collision. */
  private async nextOrderNumber(tx: Tx, tenantId: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `ORD-${randomInt(36 ** 6).toString(36).toUpperCase().padStart(6, '0')}`;
      const clash = await tx.order.findFirst({ where: { tenantId, number: candidate } });
      if (!clash) return candidate;
    }
    throw AppException.conflict('order_number', 'Could not allocate an order number; please retry');
  }
}

export interface OrderView {
  id: string;
  number: string;
  status: OrderStatus;
  customer_id: string | null;
  guest_email: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  shipping_address: unknown;
  items: Array<{ product_id: string | null; name: string; price_cents: number; quantity: number }>;
  created_at: Date;
}

function toOrderView(o: {
  id: string;
  number: string;
  status: OrderStatus;
  customerId: string | null;
  guestEmail: string | null;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: unknown;
  createdAt: Date;
  items: Array<{ productId: string | null; nameSnapshot: string; priceCents: number; quantity: number }>;
}): OrderView {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    customer_id: o.customerId,
    guest_email: o.guestEmail,
    subtotal_cents: o.subtotalCents,
    shipping_cents: o.shippingCents,
    total_cents: o.totalCents,
    currency: o.currency,
    shipping_address: o.shippingAddress,
    items: o.items.map((i) => ({
      product_id: i.productId,
      name: i.nameSnapshot,
      price_cents: i.priceCents,
      quantity: i.quantity,
    })),
    created_at: o.createdAt,
  };
}
