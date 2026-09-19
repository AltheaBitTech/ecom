import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Coupon } from '@prisma/client';
import type { z } from 'zod';
import type { quoteSchema, settingsSchema } from './storefront.schemas';

type PricedProduct = {
  id: string; name: string; priceCents: number; currency: string; publishedAt: Date | null; archivedAt: Date | null;
  gstRateBps: number;
  inventory: { quantityOnHand: number } | null;
  variants: { id: string; label: string; priceCents: number; archivedAt: Date | null }[];
};
export function priceCart(products: PricedProduct[], request: z.infer<typeof quoteSchema>, settings: z.infer<typeof settingsSchema>, coupon: Coupon | null, now = new Date()) {
  const quantities = new Map<string, number>();
  const items = request.items.map((item) => {
    const p = products.find((p) => p.id === item.productId);
    if (!p || !p.publishedAt || p.archivedAt) throw new BadRequestException('A product is no longer available. Please update your cart.');
    const variant = item.variantId ? p.variants.find((v) => v.id === item.variantId && !v.archivedAt) : undefined;
    if ((item.variantId && !variant) || (!item.variantId && p.variants.some((v) => !v.archivedAt))) throw new BadRequestException(`Choose an available option for ${p.name}`);
    const quantity = (quantities.get(p.id) ?? 0) + item.quantity;
    quantities.set(p.id, quantity);
    if (quantity > (p.inventory?.quantityOnHand ?? 0)) throw new ConflictException(`Not enough stock for ${p.name}`);
    const unitPriceCents = variant?.priceCents ?? p.priceCents;
    const lineTotalCents = unitPriceCents * item.quantity;
    // gstRateBps travels with the line so callers can compute tax, but isn't an OrderItem
    // column — strip it before the nested create (see storefront.service.ts).
    return { productId: p.id, variantId: variant?.id, variantLabel: variant?.label, quantity: item.quantity, unitPriceCents, lineTotalCents, gstRateBps: p.gstRateBps ?? 0 };
  });
  const currencies = new Set(products.filter((p) => quantities.has(p.id)).map((p) => p.currency));
  if (currencies.size !== 1) throw new BadRequestException('Cart items must use the same currency');
  const currency = [...currencies][0];
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  let discountCents = 0;
  if (request.couponCode) {
    if (!coupon || !coupon.active || coupon.startsAt > now || coupon.endsAt <= now) throw new BadRequestException('This promo code is invalid or has expired');
    if (subtotalCents < coupon.minimumCents) throw new BadRequestException(`This code needs a subtotal of ${(coupon.minimumCents / 100).toFixed(2)} ${currency}`);
    discountCents = coupon.kind === 'percent' ? Math.floor(subtotalCents * coupon.value / 100) : coupon.value;
    discountCents = Math.min(discountCents, coupon.maximumDiscountCents ?? discountCents, subtotalCents);
  }
  if (request.fulfillment === 'pickup' && !settings.pickupEnabled) throw new BadRequestException('Pickup is not available');
  const remainingForFreeShippingCents = settings.freeShippingThresholdCents === null ? null : Math.max(0, settings.freeShippingThresholdCents - (subtotalCents - discountCents));
  const shippingCents = request.fulfillment === 'pickup' || remainingForFreeShippingCents === 0 ? 0 : settings.shippingCents;
  const taxCents = items.reduce((sum, item) => sum + Math.round((item.lineTotalCents * item.gstRateBps) / 10000), 0);
  const totalCents = subtotalCents - discountCents + shippingCents + taxCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 2_000_000_000) throw new BadRequestException('Order total is too large');
  return { items, subtotalCents, discountCents, shippingCents, taxCents, totalCents, currency, couponCode: request.couponCode || null, remainingForFreeShippingCents };
}
