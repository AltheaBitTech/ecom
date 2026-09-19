import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { EnvConfig } from '../../common/config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { checkoutSchema, couponSchema, parse, quoteSchema, reviewSchema, settingsSchema } from './storefront.schemas';
import { priceCart } from './pricing';
import { z } from 'zod';

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // Public stores are per tenant: the shopper's frontend names the store via the x-store-slug header.
  // STOREFRONT_TENANT_SLUG is only the fallback for a bare, slug-less visit (a deployment's "main" store).
  // Non-ACTIVE tenants are never public — their owners use the authenticated preview instead.
  private async tenant(requested?: string) {
    const slug = requested || this.config.get('STOREFRONT_TENANT_SLUG', { infer: true });
    if (!slug) throw new ServiceUnavailableException('Storefront is not configured');
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new ServiceUnavailableException('This store is not currently available');
    return tenant;
  }

  async listProducts(tenantId?: string, slug?: string) {
    const tenant = tenantId ? { id: tenantId } : await this.tenant(slug);
    const scoped = this.prisma.forTenant(tenant.id);
    const [products, sales] = await Promise.all([
      scoped.product.findMany({
        where: { publishedAt: { not: null }, archivedAt: null },
        select: { id: true, sku: true, name: true, description: true, imageUrl: true, images: true, videos: true, labels: true, category: true, featured: true, compareAtCents: true, priceCents: true, currency: true, publishedAt: true,
          inventory: { select: { quantityOnHand: true } },
          variants: { where: { archivedAt: null }, select: { id: true, label: true, priceCents: true, compareAtCents: true }, orderBy: { createdAt: 'asc' } } },
        orderBy: { publishedAt: 'desc' },
      }),
      scoped.orderItem.groupBy({ by: ['productId'], where: { order: { tenantId: tenant.id, status: { not: 'CANCELLED' }, payment: { status: 'PAID' } } }, _sum: { quantity: true } }),
    ]);
    const sold = new Map(sales.map((s) => [s.productId, s._sum.quantity ?? 0]));
    return products.map(({ inventory, ...p }) => ({ ...p, stock: inventory?.quantityOnHand ?? 0, sold: sold.get(p.id) ?? 0 }));
  }

  async home(tenantId?: string, slug?: string) {
    const tenant = tenantId ? await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }) : await this.tenant(slug);
    const scoped = this.prisma.forTenant(tenant.id);
    const now = new Date();
    const [products, offers, reviews] = await Promise.all([
      this.listProducts(tenant.id),
      scoped.coupon.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { endsAt: 'asc' } }),
      scoped.review.findMany({ where: { published: true, product: { publishedAt: { not: null }, archivedAt: null } }, select: { id: true, productId: true, displayName: true, rating: true, body: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return { id: tenant.id, name: tenant.name, settings: settingsSchema.parse(tenant.storefront), products, offers: offers.map(({ tenantId, ...offer }) => offer), reviews };
  }

  private async quoteFor(tenantId: string, settings: unknown, input: unknown, customerEmail?: string) {
    const request = parse(quoteSchema, input);
    const scoped = this.prisma.forTenant(tenantId);
    const [products, coupon] = await Promise.all([
      scoped.product.findMany({ where: { id: { in: request.items.map((i) => i.productId) } }, include: { variants: true, inventory: true } }),
      request.couponCode ? scoped.coupon.findFirst({ where: { code: request.couponCode } }) : null,
    ]);
    if (coupon) {
      // Redeemed orders only: a cancelled order frees up its slot, same as it restocks inventory.
      const redeemedWhere = { couponCode: coupon.code, status: { not: 'CANCELLED' as const } };
      if (coupon.maxRedemptions !== null) {
        const used = await scoped.order.count({ where: redeemedWhere });
        if (used >= coupon.maxRedemptions) throw new BadRequestException('This promo code has reached its redemption limit');
      }
      if (coupon.perCustomerLimit !== null && customerEmail) {
        const usedByCustomer = await scoped.order.count({ where: { ...redeemedWhere, customer: { email: { equals: customerEmail, mode: 'insensitive' } } } });
        if (usedByCustomer >= coupon.perCustomerLimit) throw new BadRequestException('You’ve already used this promo code the maximum number of times');
      }
    }
    return priceCart(products, request, settingsSchema.parse(settings), coupon);
  }

  async quote(input: unknown, tenantId?: string, slug?: string) {
    const tenant = tenantId ? await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }) : await this.tenant(slug);
    return this.quoteFor(tenant.id, tenant.storefront, input);
  }

  async checkout(input: unknown, slug?: string) {
    const dto = parse(checkoutSchema, input);
    const tenant = await this.tenant(slug);
    const quote = await this.quoteFor(tenant.id, tenant.storefront, { items: dto.items, couponCode: dto.couponCode, fulfillment: dto.fulfillment }, dto.customerEmail);
    if (quote.totalCents < 100) throw new BadRequestException('The payable total must be at least 1.00');
    const scoped = this.prisma.forTenant(tenant.id);
    // Store this checkout's contact details; an email address alone does not authenticate a returning shopper.
    const customer = await scoped.customer.create({ data: { tenantId: tenant.id, name: dto.customerName, email: dto.customerEmail, phone: dto.customerPhone, marketingOptIn: dto.marketingOptIn } });
    const { items, remainingForFreeShippingCents, ...totals } = quote;
    const orderItems = items.map(({ gstRateBps: _gstRateBps, ...item }) => item);
    const order = await scoped.order.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        ...totals,
        delivery: { fulfillment: dto.fulfillment, ...(dto.address ?? {}) },
        items: { create: orderItems },
        events: { create: { status: 'PENDING' } },
      },
    });
    void this.notifications.notifyOrderStatusChanged({ ...order, customer }, 'PENDING');
    void this.notifications.notifyOrderPlaced(tenant.id, { ...order, customer });
    const payment = await this.payments.createPaymentForOrder(tenant.id, order.id);
    return { order: { id: order.id, ...totals }, ...payment };
  }

  async verifyPayment(input: unknown, slug?: string) {
    const dto = parse(z.object({ orderId: z.string(), razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }).strict(), input);
    const tenant = await this.tenant(slug);
    const payment = await this.prisma.forTenant(tenant.id).payment.findFirst({ where: { orderId: dto.orderId, providerOrderId: dto.razorpay_order_id } });
    if (!payment || !this.payments.verifyCheckoutSignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature)) throw new BadRequestException('Payment could not be verified');
    // The signature proves Razorpay captured this payment, so don't make the shopper's order
    // wait on the webhook — mark it paid here too. markPaid() is idempotent, so whichever of
    // the two arrives second changes nothing.
    const paid = await this.payments.markPaid(dto.razorpay_order_id, dto.razorpay_payment_id);
    return { orderId: dto.orderId, status: paid?.status ?? payment.status };
  }

  async submitReview(input: unknown, slug?: string) {
    const dto = parse(reviewSchema, input);
    const tenant = await this.tenant(slug);
    const scoped = this.prisma.forTenant(tenant.id);
    const order = await scoped.order.findFirst({ where: { id: dto.orderId, status: 'FULFILLED', payment: { status: 'PAID' }, customer: { email: { equals: dto.email, mode: 'insensitive' } }, items: { some: { productId: dto.productId } } } });
    if (!order) throw new BadRequestException('Use the order ID and email from a paid, delivered order containing this product');
    try {
      await scoped.review.create({ data: { tenantId: tenant.id, productId: dto.productId, orderId: dto.orderId, displayName: dto.displayName, rating: dto.rating, body: dto.body } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('This order already has a review for this product');
      throw error;
    }
    void this.notifications.notifyReviewSubmitted(tenant.id, dto.rating);
    return { message: 'Thank you. Your verified review will appear after moderation.' };
  }

  // ponytail: aggregated in JS over a findMany rather than SQL date_trunc/groupBy — a single
  // tenant's order volume is small enough for this to be instant; move to a raw grouped query
  // (with tenantId still bound manually, since forTenant() doesn't intercept groupBy/$queryRaw)
  // if a tenant's order history grows large enough to make this slow.
  async analytics(tenantId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // The window before `since`, so every headline number can be shown against the run-up to it
    // rather than as a bare figure with nothing to compare against.
    const previousSince = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const [tenant, orders, statusCounts, topItems, products, reviews, customerCount, newCustomers, offerCount, customerDates, deliveries, recentOrders, recentCustomers, recentReviews, orderCountsByCustomer] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { storefront: true } }),
      scoped.order.findMany({ where: { status: { not: 'CANCELLED' }, payment: { status: 'PAID' } }, select: { totalCents: true, createdAt: true } }),
      scoped.order.groupBy({ where: { tenantId }, by: ['status'], _count: { _all: true } }),
      this.prisma.orderItem.groupBy({ by: ['productId'], where: { order: { tenantId, status: { not: 'CANCELLED' }, payment: { status: 'PAID' } } }, _sum: { lineTotalCents: true, quantity: true }, orderBy: { _sum: { lineTotalCents: 'desc' } }, take: 5 }),
      scoped.product.findMany({ where: { archivedAt: null }, select: { id: true, name: true, publishedAt: true, imageUrl: true, images: true, inventory: { select: { quantityOnHand: true, reorderThreshold: true } } } }),
      scoped.review.findMany({ select: { rating: true, published: true } }),
      scoped.customer.count(),
      scoped.customer.count({ where: { createdAt: { gte: since } } }),
      scoped.coupon.count({ where: { active: true, endsAt: { gt: new Date() } } }),
      scoped.customer.findMany({ where: { createdAt: { gte: previousSince } }, select: { createdAt: true } }),
      scoped.order.findMany({ where: { status: { not: 'CANCELLED' }, payment: { status: 'PAID' } }, select: { totalCents: true, delivery: true } }),
      scoped.order.findMany({ select: { id: true, status: true, totalCents: true, currency: true, createdAt: true, customer: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 6 }),
      scoped.customer.findMany({ select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 6 }),
      scoped.review.findMany({ select: { id: true, displayName: true, rating: true, createdAt: true, product: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 6 }),
      this.prisma.order.groupBy({ by: ['customerId'], where: { tenantId, status: { not: 'CANCELLED' }, payment: { status: 'PAID' } }, _count: { _all: true } }),
    ]);
    const revenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const orderCount = orders.length;
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().slice(0, 10), revenueCents: 0, orders: 0, customers: 0 };
    });
    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const o of orders) {
      const bucket = byDate.get(o.createdAt.toISOString().slice(0, 10));
      if (bucket) { bucket.revenueCents += o.totalCents; bucket.orders += 1; }
    }
    for (const c of customerDates) {
      const bucket = byDate.get(c.createdAt.toISOString().slice(0, 10));
      if (bucket) bucket.customers += 1;
    }

    // Each headline figure paired with the same measure over the preceding 30 days. A percentage
    // change is only meaningful when the earlier window had something in it, so `null` means
    // "no basis for comparison" and the UI shows nothing rather than a misleading +100%.
    const inWindow = (d: Date, from: Date, to?: Date) => d >= from && (!to || d < to);
    const current = orders.filter((o) => inWindow(o.createdAt, since));
    const previous = orders.filter((o) => inWindow(o.createdAt, previousSince, since));
    const sum = (list: { totalCents: number }[]) => list.reduce((n, o) => n + o.totalCents, 0);
    const change = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);
    const previousCustomers = customerDates.filter((c) => inWindow(c.createdAt, previousSince, since)).length;
    const aov = (list: { totalCents: number }[]) => (list.length ? Math.round(sum(list) / list.length) : 0);
    const trend = {
      revenue: { current: sum(current), previous: sum(previous), changePct: change(sum(current), sum(previous)) },
      orders: { current: current.length, previous: previous.length, changePct: change(current.length, previous.length) },
      customers: { current: newCustomers, previous: previousCustomers, changePct: change(newCustomers, previousCustomers) },
      avgOrderValue: { current: aov(current), previous: aov(previous), changePct: change(aov(current), aov(previous)) },
    };

    // Mutually exclusive and exhaustive, so the three add up to customerCount.
    const paidOrdersPerCustomer = new Map(orderCountsByCustomer.map((g) => [g.customerId, g._count._all]));
    const repeat = [...paidOrdersPerCustomer.values()].filter((n) => n >= 2).length;
    const single = [...paidOrdersPerCustomer.values()].filter((n) => n === 1).length;
    const customerSegments = { repeat, single, neverOrdered: Math.max(0, customerCount - repeat - single) };

    // Grouped from the delivery address captured at checkout. Pickup orders carry no state, and
    // older orders may predate the field, so both land in "Not specified" rather than being dropped.
    const regionTotals = new Map<string, { revenueCents: number; orders: number }>();
    for (const o of deliveries) {
      const delivery = o.delivery as { state?: unknown } | null;
      const state = typeof delivery?.state === 'string' && delivery.state.trim() ? delivery.state.trim() : 'Not specified';
      const bucket = regionTotals.get(state) ?? { revenueCents: 0, orders: 0 };
      bucket.revenueCents += o.totalCents;
      bucket.orders += 1;
      regionTotals.set(state, bucket);
    }
    const salesByRegion = [...regionTotals.entries()]
      .map(([region, v]) => ({ region, ...v }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 6);

    const activity = [
      ...recentOrders.map((o) => ({ kind: 'order' as const, id: o.id, at: o.createdAt, title: `${o.customer.name} placed an order`, detail: `${o.currency} ${(o.totalCents / 100).toFixed(2)} · ${o.status.toLowerCase()}`, link: `/admin/orders/${o.id}` })),
      ...recentCustomers.map((c) => ({ kind: 'customer' as const, id: c.id, at: c.createdAt, title: `${c.name} joined your store`, detail: 'New customer', link: '/admin/customers' })),
      ...recentReviews.map((r) => ({ kind: 'review' as const, id: r.id, at: r.createdAt, title: `${r.displayName} reviewed ${r.product.name}`, detail: `${r.rating} out of 5`, link: '/admin/storefront' })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8);
    const productName = new Map(products.map((p) => [p.id, p.name]));
    const topProducts = topItems.map((t) => ({ productId: t.productId, name: productName.get(t.productId) ?? 'Unknown product', revenueCents: t._sum.lineTotalCents ?? 0, quantity: t._sum.quantity ?? 0 }));
    const lowStock = products.filter((p) => p.inventory && p.inventory.quantityOnHand > 0 && p.inventory.quantityOnHand <= p.inventory.reorderThreshold).length;
    const outOfStock = products.filter((p) => !p.inventory || p.inventory.quantityOnHand === 0).length;
    const publishedReviews = reviews.filter((r) => r.published);
    // Storefront readiness — what a shopper would actually be able to do right now. Surfaced on
    // the admin overview so an unsellable store (imported catalogue, zero stock, no contact
    // details) says so on the dashboard instead of only looking empty on the storefront.
    const settings = settingsSchema.parse(tenant.storefront);
    const published = products.filter((p) => p.publishedAt);
    const setup = {
      publishedCount: published.length,
      sellableCount: published.filter((p) => (p.inventory?.quantityOnHand ?? 0) > 0).length,
      withoutImages: published.filter((p) => !p.imageUrl && !p.images.length).length,
      contactSet: !!(settings.supportEmail || settings.phone),
      deliverySet: settings.shippingCents > 0 || settings.pickupEnabled || settings.deliveryNote !== settingsSchema.parse({}).deliveryNote,
      activeOffers: offerCount,
    };
    return {
      revenueCents, orderCount, avgOrderValueCents: orderCount ? Math.round(revenueCents / orderCount) : 0,
      setup,
      daily: days,
      ordersByStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
      topProducts,
      productCount: products.length, lowStock, outOfStock,
      customerCount, newCustomers,
      trend, customerSegments, salesByRegion, activity,
      reviewCount: publishedReviews.length, pendingReviews: reviews.length - publishedReviews.length,
      avgRating: publishedReviews.length ? publishedReviews.reduce((s, r) => s + r.rating, 0) / publishedReviews.length : null,
    };
  }

  async administration(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const scoped = this.prisma.forTenant(tenantId);
    const [offers, reviews] = await Promise.all([scoped.coupon.findMany({ orderBy: { createdAt: 'desc' } }), scoped.review.findMany({ include: { product: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 })]);
    return { settings: settingsSchema.parse(tenant.storefront), offers, reviews };
  }
  async saveSettings(tenantId: string, input: unknown) {
    const settings = parse(settingsSchema, input);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { storefront: settings } });
    return settings;
  }
  async saveCoupon(tenantId: string, id: string | undefined, input: unknown) {
    const dto = parse(couponSchema, input);
    const scoped = this.prisma.forTenant(tenantId);
    const data = { ...dto, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) };
    if (id && !await scoped.coupon.findFirst({ where: { id } })) throw new NotFoundException('Offer not found');
    try { return id ? await scoped.coupon.update({ where: { id }, data }) : await scoped.coupon.create({ data: { ...data, tenantId } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('This coupon code already exists'); throw error; }
  }
  async moderateReview(tenantId: string, id: string, input: unknown) {
    const data = parse(z.object({ published: z.boolean() }).strict(), input);
    const scoped = this.prisma.forTenant(tenantId);
    if (!await scoped.review.findFirst({ where: { id } })) throw new NotFoundException('Review not found');
    return scoped.review.update({ where: { id }, data });
  }
}
