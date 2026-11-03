import Link from 'next/link';
import type { CSSProperties } from 'react';

import { EmptyState } from '@/components/ui/primitives';
import { formatMoney } from '@/lib/format';
import type { StoreDesignConfig, StoreSectionConfig, StoreTemplate } from '@/lib/store-templates';
import type { ActiveFlashSale, Category, Product } from '@/lib/types';

import { DealCountdown } from './deal-countdown';
import { PreviewBridge } from './preview-bridge';
import { ProductCard } from './product-card';
import { StoreHero } from './store-hero';

export type StoreSearch = { category?: string; sort?: string; q?: string };
const text =(data: Record<string, unknown>, key: string, fallback: string) => typeof data[key] === 'string' ? data[key] as string : fallback;
const ids = (data: Record<string, unknown>, key: string) => Array.isArray(data[key]) ? (data[key] as unknown[]).filter((value): value is string => typeof value === 'string') : [];

export function StoreSections({ tenant, tenantId, storeName, template, design, products, categories, flashSales = [], search, preview = false }: { tenant: string; tenantId: string; storeName: string; template: StoreTemplate; design: StoreDesignConfig; products: Product[]; categories: Category[]; flashSales?: ActiveFlashSale[]; search: StoreSearch; preview?: boolean }) {
  // In preview, wrap each section in a display:contents marker (no layout impact)
  // so the studio iframe can map a click back to the section being edited.
  return <>{preview && <PreviewBridge />}{design.sections.filter((section) => section.enabled).map((section) => preview
    ? <div key={section.id} data-design-section={section.id} style={{ display: 'contents' }}><StoreSection section={section} tenant={tenant} tenantId={tenantId} storeName={storeName} template={template} design={design} products={products} categories={categories} flashSales={flashSales} search={search} /></div>
    : <StoreSection key={section.id} section={section} tenant={tenant} tenantId={tenantId} storeName={storeName} template={template} design={design} products={products} categories={categories} flashSales={flashSales} search={search} />)}</>;
}

function StoreSection(props: { section: StoreSectionConfig; tenant: string; tenantId: string; storeName: string; template: StoreTemplate; design: StoreDesignConfig; products: Product[]; categories: Category[]; flashSales: ActiveFlashSale[]; search: StoreSearch }) {
  const { section, tenant, tenantId, storeName, template, design, products, categories, flashSales, search } = props;
  if (section.type === 'hero') return <StoreHero tenant={tenant} tenantId={tenantId} storeName={storeName} template={template} design={design} section={section} products={selectProducts(products, section.data)} categories={selectCategories(categories, section.data)} />;
  if (section.type === 'category-rail') return <CategorySection tenant={tenant} section={section} categories={selectCategories(categories, section.data)} />;
  if (section.type === 'product-collection') return <ProductSection tenant={tenant} section={section} products={selectProducts(products, section.data)} categories={categories} search={search} />;
  if (section.type === 'promotion-split' || section.type === 'promotion-mosaic' || section.type === 'brand-story') return <PromotionSection tenant={tenant} tenantId={tenantId} section={section} products={products} />;
  if (section.type === 'trust-bar') return <TrustSection section={section} />;
  if (section.type === 'testimonials') return <Testimonials section={section} />;
  if (section.type === 'logo-strip') return <LogoStrip section={section} />;
  if (section.type === 'newsletter') return <Newsletter section={section} />;
  if (section.type === 'faq') return <FaqSection section={section} />;
  if (section.type === 'deal-countdown') return <><DealSection tenant={tenant} section={section} products={selectProducts(products, section.data)} flashSales={flashSales} /><DealTicker design={design} /></>;
  return null;
}

function selectProducts(products: Product[], data: Record<string, unknown>) {
  const selected = ids(data, 'productIds');
  if (selected.length) return selected.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
  if (data.source === 'featured') return products.filter((product) => product.is_featured || product.is_bestseller).slice(0, 8);
  if (data.source === 'bestseller') return products.filter((product) => product.is_bestseller).slice(0, 8);
  return products;
}

function selectCategories(categories: Category[], data: Record<string, unknown>) {
  const selected = ids(data, 'categoryIds');
  if (selected.length) return selected.map((id) => categories.find((category) => category.id === id)).filter((category): category is Category => Boolean(category));
  const featured = categories.filter((category) => category.is_featured);
  return (featured.length ? featured : categories).slice(0, 8);
}

function CategorySection({ tenant, section, categories }: { tenant: string; section: StoreSectionConfig; categories: Category[] }) {
  if (!categories.length) return null;
  if (section.variant === 'list') {
    return <section className="store-module store-categories-list"><ModuleHeading eyebrow="Browse departments" title={text(section.data, 'title', 'Our Trending Categories')} /><div className="store-category-list-grid">{categories.map((category) => <Link key={category.id} href={`/${tenant}/collections/${category.id}`} className="store-category-row"><span className="store-category-row-copy"><strong>{category.name}</strong>{category.description && <small>{category.description}</small>}<em>View all</em></span>{category.image_url ? <img src={category.image_url} alt="" /> : <span className="store-category-row-icon" aria-hidden>🛒</span>}</Link>)}</div></section>;
  }
  return <section className={`store-module store-categories store-categories-${section.variant ?? 'cards'}`}><ModuleHeading eyebrow="Browse departments" title={text(section.data, 'title', 'Shop by category')} /><div className="store-category-grid">{categories.map((category, index) => <Link key={category.id} href={`/${tenant}/collections/${category.id}`} className="store-category group">{category.image_url ? <img src={category.image_url} alt="" /> : <span className="store-category-placeholder">{String(index + 1).padStart(2, '0')}</span>}<span className="store-category-shade" /><span className="store-category-copy"><strong>{category.name}</strong><small>{category.description ?? 'Explore collection'}</small></span><i>↗</i></Link>)}</div></section>;
}

function ProductSection({ tenant, section, products }: { tenant: string; section: StoreSectionConfig; products: Product[]; categories: Category[]; search: StoreSearch }) {
  // Homepage "catalog" section is a one-row teaser that links to the full
  // /products page (filters + sorting + every item live there).
  const catalog = section.variant === 'catalog' || section.data.source === 'all';
  const shown = catalog ? products.slice(0, 6) : products;
  return <section id={catalog ? 'collection' : undefined} className={`store-module store-products-section store-products-${section.variant ?? 'grid'} ${catalog ? 'is-catalog' : ''}`}><div className="store-product-heading"><ModuleHeading eyebrow={catalog ? 'The collection' : 'Selected for you'} title={text(section.data, 'title', catalog ? 'Shop all' : 'Featured edit')} />{catalog && <Link href={`/${tenant}/products`} className="store-shop-all-link">Shop all products ↗</Link>}</div>{shown.length ? <div className="store-product-grid">{shown.map((product, index) => <ProductCard key={product.id} tenant={tenant} product={product} index={index} />)}</div> : <EmptyState icon="✦" title="New things are on the way" description="There are no published products yet." />}{catalog && shown.length > 0 && <Link href={`/${tenant}/products`} className="store-shop-all-btn">View all products ↗</Link>}</section>;
}

function PromotionSection({ tenant, tenantId, section, products }: { tenant: string; tenantId: string; section: StoreSectionConfig; products: Product[] }) {
  // Trio: a row of 3 offer cards (GreenBasket-style) driven by data.cards.
  const cards = Array.isArray(section.data.cards) ? (section.data.cards as Array<Record<string, unknown>>) : null;
  if (cards?.length) {
    return <section className="store-module store-promotion-trio">{cards.map((card, i) => {
      const href = typeof card.href === 'string' ? `/${tenant}${card.href}` : `/${tenant}#collection`;
      const img = typeof card.image === 'string' ? card.image : undefined;
      const tint = typeof card.tint === 'string' ? card.tint : undefined;
      return <Link key={i} href={href} className="store-promo-card" style={tint ? ({ ['--promo-tint']: tint } as CSSProperties) : undefined}><div className="store-promo-body"><span className="store-promo-eyebrow" data-design-field={`cards.${i}.eyebrow`}>{text(card, 'eyebrow', 'Fresh deals')}</span><strong className="store-promo-offer" data-design-field={`cards.${i}.title`}>{text(card, 'title', 'UP TO 25% OFF')}</strong><span className="store-promo-cta"><span data-design-field={`cards.${i}.cta`}>{text(card, 'cta', 'Shop Now')}</span> ↗</span></div>{img && <img className="store-promo-img" src={img} alt="" />}</Link>;
    })}</section>;
  }
  const product = products[0]; const mediaId = text(section.data, 'mediaId', ''); const image = mediaId ? `${process.env.NEXT_PUBLIC_ECOM_API_URL ?? 'http://localhost:4001'}/v1/storefront/${tenantId}/media/${mediaId}` : product?.images[0];
  return <section className={`store-module store-promotion store-promotion-${section.variant ?? 'split'}`}><div className="store-promotion-copy"><span>{text(section.data, 'eyebrow', 'The story')}</span><h2 data-design-field="title">{text(section.data, 'title', 'Made for your everyday')}</h2><p data-design-field="body">{text(section.data, 'body', 'Thoughtful products, useful details, and service that stays out of your way.')}</p><Link href={product ? `/${tenant}/products/${product.id}` : `/${tenant}#collection`}>{text(section.data, 'cta', 'Discover more')} ↗</Link></div><div className="store-promotion-media">{image ? <img src={image} alt={text(section.data, 'imageAlt', '')} /> : <span>✦</span>}</div></section>;
}

function TrustSection({ section }: { section: StoreSectionConfig }) {
  const items = Array.isArray(section.data.items) ? (section.data.items as Array<Record<string, unknown>>) : null;
  if (items?.length) {
    return <section className="store-trust store-trust-rich">{section.data.title ? <h2 className="store-trust-title">{text(section.data, 'title', '')}</h2> : null}<div className="store-trust-items">{items.map((item, i) => <span key={i}><b>{text(item, 'icon', '✓')}</b><strong>{text(item, 'title', '')}</strong><small>{text(item, 'body', '')}</small></span>)}</div></section>;
  }
  return <section className="store-trust"><span><b>◇</b> Secure payments</span><span><b>↗</b> Fast dispatch</span><span><b>↺</b> Simple returns</span><span><b>♡</b> Human support</span></section>;
}
function FaqSection({ section }: { section: StoreSectionConfig }) {
  const items = Array.isArray(section.data.items) ? (section.data.items as Array<Record<string, unknown>>) : [];
  if (!items.length) return null;
  return <section className="store-module store-faq"><ModuleHeading eyebrow="Have a question?" title={text(section.data, 'title', 'Frequently Asked Questions')} /><div className="store-faq-list">{items.map((item, i) => <details key={i} className="store-faq-item"><summary>{text(item, 'question', '')}</summary><p>{text(item, 'answer', '')}</p></details>)}</div></section>;
}

function DealSection({ tenant, section, products, flashSales }: { tenant: string; section: StoreSectionConfig; products: Product[]; flashSales: ActiveFlashSale[] }) {
  const byProduct = new Map(flashSales.map((sale) => [sale.product_id, sale]));
  const deals = products.map((product) => ({ product, sale: byProduct.get(product.id) })).filter((row): row is { product: Product; sale: ActiveFlashSale } => Boolean(row.sale));
  if (!deals.length) return null;
  // All deals on this store share one countdown — the earliest end time wins.
  const endsAt = deals.reduce((earliest, row) => row.sale.ends_at < earliest ? row.sale.ends_at : earliest, deals[0].sale.ends_at);
  return <section className="store-module store-deal-countdown"><div className="store-deal-panel"><span className="store-deal-eyebrow">Hot this month</span><h2>{text(section.data, 'title', 'Deal Of The Month')}</h2><p>Save on hand-picked products while the clock runs.</p><DealCountdown endsAt={endsAt} /></div><div className="store-deal-products">{deals.slice(0, 5).map(({ product, sale }) => <Link key={product.id} href={`/${tenant}/products/${product.id}`} className="store-deal-product"><span className="store-deal-product-media">{product.images[0] ? <img src={product.images[0]} alt="" /> : <i aria-hidden>{product.name.charAt(0)}</i>}</span><strong>{product.name}</strong><span className="store-deal-product-price">{formatMoney(sale.sale_price_cents, product.currency)}<small>{formatMoney(product.price_cents, product.currency)}</small></span></Link>)}</div></section>;
}

/** Slow horizontal scroller of the store's own tagline + announcement, sitting
 *  between the deal panel and the category list — pure decoration, admin copy. */
function DealTicker({ design }: { design: StoreDesignConfig }) {
  const phrase = design.global.tagline || design.global.announcement;
  if (!phrase) return null;
  const items = Array.from({ length: 6 }, () => phrase);
  return <div className="store-ticker" aria-hidden><div className="marquee-track store-ticker-track">{[...items, ...items].map((item, i) => <span key={i}>{item}</span>)}</div></div>;
}

function Testimonials({ section }: { section: StoreSectionConfig }) { return <section className="store-module store-testimonials"><ModuleHeading eyebrow="People are talking" title={text(section.data, 'title', 'Loved in real life.')} /><blockquote><span data-design-field="quote">{text(section.data, 'quote', 'Beautiful products and an experience that makes choosing easy.')}</span><cite>— <span data-design-field="author">{text(section.data, 'author', 'A happy customer')}</span></cite></blockquote></section>; }
function LogoStrip({ section }: { section: StoreSectionConfig }) { const labels = ids(section.data, 'labels'); return <section className="store-logo-strip">{(labels.length ? labels : ['Thoughtful', 'Useful', 'Original', 'Reliable']).map((label) => <span key={label}>{label}</span>)}</section>; }
function Newsletter({ section }: { section: StoreSectionConfig }) { return <section className="store-module store-newsletter"><div><span>Stay in the loop</span><h2 data-design-field="title">{text(section.data, 'title', 'Good things, delivered.')}</h2><p data-design-field="body">{text(section.data, 'body', 'New products and private offers, occasionally.')}</p></div><form><label className="sr-only" htmlFor={`newsletter-${section.id}`}>Email address</label><input id={`newsletter-${section.id}`} type="email" placeholder="Email address" /><button type="submit">Join ↗</button></form></section>; }
function ModuleHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="store-module-heading"><span>{eyebrow}</span><h2 data-design-field="title">{title}</h2></div>; }
