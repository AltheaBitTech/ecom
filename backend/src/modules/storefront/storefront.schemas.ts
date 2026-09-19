import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const cents = z.number().int().min(0).max(100_000_000);
const httpsUrl = z.string().url().refine((url) => url.startsWith('https://'), 'Use an HTTPS image URL');
export const settingsSchema = z.object({
  headline: text(100).default('Good things, thoughtfully chosen.'),
  tagline: text(80).default('A little discovery. An everyday favourite.'),
  description: text(350).default('Explore our collection, find your favourites, and make a little room for something new.'),
  heroImage: z.union([httpsUrl, z.literal('')]).default(''),
  announcement: text(140).default('Discover something you’ll love.'),
  supportEmail: z.union([z.string().email(), z.literal('')]).default(''),
  phone: text(40).regex(/^[+\d\s()-]*$/).default(''),
  address: text(300).default(''),
  deliveryNote: text(500).default('Contact the store for delivery availability and estimated arrival times.'),
  shippingCents: cents.default(0),
  freeShippingThresholdCents: cents.nullable().default(null),
  pickupEnabled: z.boolean().default(false),
  faq: z.array(z.object({ question: text(150).min(1), answer: text(700).min(1) }).strict()).max(10).default([]),
}).strict();
export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/),
  title: text(100).min(1), description: text(300).default(''),
  kind: z.enum(['percent', 'fixed']), value: cents.refine((v) => v > 0),
  minimumCents: cents.default(0), maximumDiscountCents: cents.nullable().default(null),
  startsAt: z.string().datetime(), endsAt: z.string().datetime(), active: z.boolean().default(true),
  maxRedemptions: z.number().int().min(1).max(1_000_000).nullable().default(null),
  perCustomerLimit: z.number().int().min(1).max(1000).nullable().default(null),
}).strict().refine((v) => v.kind !== 'percent' || v.value <= 100, 'Percentage must be at most 100')
  .refine((v) => v.maximumDiscountCents === null || v.maximumDiscountCents > 0, 'Discount cap must be positive')
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), 'End must follow start');
export const quoteSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), variantId: z.string().min(1).optional(), quantity: z.number().int().min(1).max(999) }).strict()).min(1).max(100),
  couponCode: text(30).transform((v) => v.toUpperCase()).optional(),
  fulfillment: z.enum(['delivery', 'pickup']).default('delivery'),
}).strict();
export const checkoutSchema = quoteSchema.extend({
  customerName: text(100).min(1), customerEmail: z.string().trim().email().transform((v) => v.toLowerCase()),
  customerPhone: text(40).optional(),
  address: z.object({ line: text(200).min(3), city: text(80).min(1), state: text(80).min(1), postalCode: text(20).min(3) }).strict().optional(),
  // Marketing consent, ticked by the shopper. Defaults to false: a missing field is a "no",
  // never an assumed yes.
  marketingOptIn: z.boolean().default(false),
}).refine((v) => v.fulfillment !== 'delivery' || !!v.address, 'Delivery address is required');
export const reviewSchema = z.object({
  productId: z.string().min(1), orderId: z.string().min(1), email: z.string().trim().email(),
  displayName: text(60).min(1), rating: z.number().int().min(1).max(5), body: text(1500).min(10),
}).strict();
export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return result.data;
}
