export type StoreSectionType = 'hero' | 'category-rail' | 'product-collection' | 'promotion-split' | 'promotion-mosaic' | 'brand-story' | 'trust-bar' | 'testimonials' | 'newsletter' | 'logo-strip' | 'faq' | 'deal-countdown';

export interface StoreSectionConfig {
  id: string;
  type: StoreSectionType;
  enabled: boolean;
  variant?: string;
  data: Record<string, unknown>;
}

export interface StoreNavItem {
  label: string;
  href: string;
  children?: Array<{ label: string; href: string }>;
}

export interface StoreDesignConfig {
  schemaVersion: 1;
  templateId: StoreTemplateId;
  tokens: {
    colors: { primary: string; primaryForeground: string; background: string; accent: string };
    headingFont: 'display' | 'editorial' | 'modern' | 'technical' | 'friendly';
    bodyFont: 'sans' | 'editorial' | 'modern';
    radius: 'none' | 'small' | 'medium' | 'large' | 'pill';
    density: 'airy' | 'balanced' | 'compact';
  };
  global: {
    logoMediaId: string | null;
    announcement: string;
    tagline: string;
    navigation: StoreNavItem[];
    footer: { heading: string; body: string };
    socialLinks: Array<{ label: string; url: string }>;
  };
  sections: StoreSectionConfig[];
}

// GreenBasket is the only storefront design — every tenant gets this one,
// admin-editable via the design studio. No template picker.
export const STORE_TEMPLATES = [
  { id: 'greenbasket', tier: 'pro', style: 'greenbasket', heroLayout: 'market', chrome: 'marketplace', productLayout: 'market', industry: 'Grocery', name: 'GreenBasket', description: 'Bright fresh-grocery storefront — split hero with a discount badge, category tiles, offer cards, and quick-add product grid.', bestFor: ['Grocery', 'Supermarket', 'Organic'], heroTitle: 'Fresh Groceries Delivered to', heroAccent: 'Your Doorstep', eyebrow: 'Eat fresh, live healthy', colors: { primary: '#2e9e4b', primaryForeground: '#ffffff', background: '#f4f8f0', accent: '#cdeeb4' }, tokens: { headingFont: 'friendly', bodyFont: 'sans', radius: 'large', density: 'compact' }, sections: [
    { id: 'hero', type: 'hero', enabled: true, variant: 'market', data: {} },
    { id: 'categories', type: 'category-rail', enabled: true, variant: 'list', data: { title: 'Our Trending Categories' } },
    { id: 'promos', type: 'promotion-mosaic', enabled: true, variant: 'trio', data: { cards: [
      { eyebrow: 'Fresh From Farm to Table', title: 'UP TO 25% OFF', cta: 'Shop Now', href: '/#collection', tint: '#e7f3dd' },
      { eyebrow: 'Stock Up & Save on Daily Essentials', title: 'UP TO 30% OFF', cta: 'Shop Now', href: '/#collection', tint: '#fdf0d8' },
      { eyebrow: 'Exclusive Deals This Week', title: 'UP TO 40% OFF', cta: 'Shop Now', href: '/#collection', tint: '#ece5f6' },
    ] } },
    { id: 'deal', type: 'deal-countdown', enabled: true, variant: 'inline', data: { title: 'Deal Of The Month', productIds: [] } },
    { id: 'featured', type: 'product-collection', enabled: true, variant: 'market', data: { title: 'Featured Products', source: 'featured' } },
    { id: 'trust', type: 'trust-bar', enabled: true, variant: 'inline', data: { title: 'Why Shop With Us?', items: [
      { icon: '✓', title: 'Best Quality', body: 'We provide only the best quality' },
      { icon: '₹', title: 'Affordable Prices', body: 'Best deals & offers everyday' },
      { icon: '⚡', title: 'Fast Delivery', body: 'On time, at your doorstep' },
      { icon: '🔒', title: 'Secure Payments', body: 'Multiple secure payment options' },
      { icon: '☎', title: '24/7 Support', body: 'We are always here to help' },
    ] } },
    { id: 'collection', type: 'product-collection', enabled: true, variant: 'catalog', data: { title: 'Shop all', source: 'all' } },
    { id: 'faq', type: 'faq', enabled: true, variant: 'split', data: { title: 'Frequently Asked Questions', items: [
      { question: 'What payment methods are accepted?', answer: 'We accept all major cards, UPI, and cash on delivery.' },
      { question: 'How long does delivery take?', answer: 'Most orders arrive within 24 hours of being placed.' },
    ] } },
    { id: 'newsletter', type: 'newsletter', enabled: true, variant: 'split', data: { title: 'Get the Best Offers Straight to Your Inbox!', body: 'Subscribe to our newsletter & get 10% OFF on your first order.' } },
  ] },
] as const;

export type StoreTemplateId = (typeof STORE_TEMPLATES)[number]['id'];
export type StoreTemplate = (typeof STORE_TEMPLATES)[number];

export function getStoreTemplate(_id?: string): StoreTemplate {
  return STORE_TEMPLATES[0];
}

export function createDefaultDesign(templateId: StoreTemplateId = 'greenbasket'): StoreDesignConfig {
  const template = getStoreTemplate(templateId);
  return {
    schemaVersion: 1, templateId: template.id,
    tokens: { colors: { ...template.colors }, ...template.tokens },
    global: { logoMediaId: null, announcement: 'Free shipping on qualifying orders', tagline: 'Thoughtful products, clear prices, and service worth returning for.', navigation: [], footer: { heading: '', body: '' }, socialLinks: [] },
    sections: template.sections.map((section) => ({ ...section, data: { ...section.data } })),
  };
}

export function normalizeStoreDesign(theme: unknown): StoreDesignConfig {
  if (theme && typeof theme === 'object' && (theme as { schemaVersion?: number }).schemaVersion === 1) return theme as StoreDesignConfig;
  const legacy = theme && typeof theme === 'object' ? theme as { colors?: Partial<StoreDesignConfig['tokens']['colors']>; content?: Record<string, string> } : {};
  const template = getStoreTemplate();
  const design = createDefaultDesign(template.id);
  design.tokens.colors = { ...design.tokens.colors, ...legacy.colors };
  design.global.announcement = legacy.content?.announcement ?? design.global.announcement;
  design.global.tagline = legacy.content?.tagline ?? design.global.tagline;
  design.sections[0].data = { title: legacy.content?.heroTitle ?? template.heroTitle, accent: legacy.content?.heroAccent ?? template.heroAccent };
  return design;
}
