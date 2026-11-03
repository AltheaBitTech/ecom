import { z } from 'zod';

import { AppException } from '../../common/errors/app-exception';

// GreenBasket is the only storefront design — every tenant gets this one,
// admin-editable via the design studio. No template picker.
export const TEMPLATE_IDS = ['greenbasket'] as const;

export type StoreTemplateId = (typeof TEMPLATE_IDS)[number];

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const sectionType = z.enum(['hero', 'category-rail', 'product-collection', 'promotion-split', 'promotion-mosaic', 'brand-story', 'trust-bar', 'testimonials', 'newsletter', 'logo-strip', 'faq', 'deal-countdown']);
const navItem = z.object({ label: z.string().min(1).max(32), href: z.string().min(1).max(240), children: z.array(z.object({ label: z.string().min(1).max(32), href: z.string().min(1).max(240) })).max(6).optional() });

export const storeDesignSchema = z.object({
  schemaVersion: z.literal(1),
  templateId: z.enum(TEMPLATE_IDS),
  tokens: z.object({
    colors: z.object({ primary: hex, primaryForeground: hex, background: hex, accent: hex }),
    headingFont: z.enum(['display', 'editorial', 'modern', 'technical', 'friendly']),
    bodyFont: z.enum(['sans', 'editorial', 'modern']),
    radius: z.enum(['none', 'small', 'medium', 'large', 'pill']),
    density: z.enum(['airy', 'balanced', 'compact']),
  }),
  global: z.object({
    logoMediaId: z.string().max(64).nullable().default(null),
    announcement: z.string().max(120).default(''),
    tagline: z.string().max(180).default(''),
    navigation: z.array(navItem).max(8).default([]),
    footer: z.object({ heading: z.string().max(80).default(''), body: z.string().max(240).default('') }).default({ heading: '', body: '' }),
    socialLinks: z.array(z.object({ label: z.string().min(1).max(24), url: z.string().url() })).max(6).default([]),
  }),
  sections: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    type: sectionType,
    enabled: z.boolean(),
    variant: z.string().max(32).optional(),
    data: z.record(z.unknown()).default({}),
  })).min(1).max(20),
}).superRefine((design, ctx) => {
  const ids = new Set<string>();
  for (const [index, section] of design.sections.entries()) {
    if (ids.has(section.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sections', index, 'id'], message: 'Section IDs must be unique' });
    ids.add(section.id);
  }
});

export type StoreDesign = z.infer<typeof storeDesignSchema>;

// GreenBasket is the only storefront template; new tenants provision straight
// into it. ponytail: this literal duplicates frontend store-templates.ts
// (greenbasket entry) — dedupe only if a shared JSON export appears.
export function defaultStoreDesign(templateId: StoreTemplateId = 'greenbasket', legacy: Record<string, unknown> = {}): StoreDesign {
  const colors = (legacy.colors ?? {}) as Record<string, unknown>;
  const content = (legacy.content ?? {}) as Record<string, unknown>;
  return {
    schemaVersion: 1,
    templateId,
    tokens: {
      colors: {
        primary: typeof colors.primary === 'string' ? colors.primary : '#2e9e4b',
        primaryForeground: typeof colors.primaryForeground === 'string' ? colors.primaryForeground : '#ffffff',
        background: typeof colors.background === 'string' ? colors.background : '#f4f8f0',
        accent: typeof colors.accent === 'string' ? colors.accent : '#cdeeb4',
      },
      headingFont: 'friendly', bodyFont: 'sans', radius: 'large', density: 'compact',
    },
    global: {
      logoMediaId: null,
      announcement: typeof content.announcement === 'string' ? content.announcement : '🚚 Free Delivery on Orders Over ₹499 · 10% OFF your first order — code WELCOME10',
      tagline: typeof content.tagline === 'string' ? content.tagline : 'Fresh choices, healthy life — daily essentials delivered to your doorstep.',
      navigation: [], footer: { heading: '', body: '' }, socialLinks: [],
    },
    sections: [
      { id: 'hero', type: 'hero', enabled: true, variant: 'market', data: { title: content.heroTitle ?? 'Fresh Groceries Delivered to', accent: content.heroAccent ?? 'Your Doorstep' } },
      { id: 'categories', type: 'category-rail', enabled: true, variant: 'list', data: { title: 'Our Trending Categories' } },
      { id: 'promos', type: 'promotion-mosaic', enabled: true, variant: 'trio', data: { cards: [
        { eyebrow: 'Fresh From Farm to Table', title: 'UP TO 25% OFF', cta: 'Shop Now', href: '/#collection', tint: '#e7f3dd' },
        { eyebrow: 'Stock Up & Save on Daily Essentials', title: 'UP TO 30% OFF', cta: 'Shop Now', href: '/#collection', tint: '#fdf0d8' },
        { eyebrow: 'Exclusive Deals This Week', title: 'UP TO 40% OFF', cta: 'Shop Now', href: '/#collection', tint: '#ece5f6' },
      ] } },
      { id: 'featured', type: 'product-collection', enabled: true, variant: 'market', data: { title: 'Featured Products', source: 'featured' } },
      { id: 'trust', type: 'trust-bar', enabled: true, variant: 'inline', data: { title: 'Why Shop With Us?', items: [
        { icon: '✓', title: 'Best Quality', body: 'We provide only the best quality' },
        { icon: '₹', title: 'Affordable Prices', body: 'Best deals & offers everyday' },
        { icon: '⚡', title: 'Fast Delivery', body: 'On time, at your doorstep' },
        { icon: '🔒', title: 'Secure Payments', body: 'Multiple secure payment options' },
        { icon: '☎', title: '24/7 Support', body: 'We are always here to help' },
      ] } },
      { id: 'collection', type: 'product-collection', enabled: true, variant: 'catalog', data: { title: 'Shop all', source: 'all' } },
      { id: 'newsletter', type: 'newsletter', enabled: true, variant: 'split', data: { title: 'Get the Best Offers Straight to Your Inbox!', body: 'Subscribe to our newsletter & get 10% OFF on your first order.' } },
    ],
  };
}

// Any legacy tenant row still carrying an old template id (editorial, minimal,
// organic, luxury, playful, or one of the removed StoreTemplateId literals)
// just falls back to greenbasket — there's only one design now.
export function normalizeStoreDesign(input: unknown): StoreDesign {
  const parsed = storeDesignSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const legacy = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return defaultStoreDesign('greenbasket', legacy);
}

export function parseStoreDesign(input: unknown): StoreDesign {
  const parsed = storeDesignSchema.safeParse(input);
  if (!parsed.success) throw AppException.validation(parsed.error.issues[0]?.message ?? 'Invalid storefront design');
  return parsed.data;
}

// Single template, no plan-tiered access left to gate.
export function templateAccess(_templateId: StoreTemplateId, _features: Record<string, boolean>): boolean {
  return true;
}
