import Link from 'next/link';

import type { StoreDesignConfig, StoreSectionConfig, StoreTemplate } from '@/lib/store-templates';
import type { Category, Product } from '@/lib/types';

/** Two-panel hero: a photo/lifestyle panel with the main pitch, and a second
 *  brand-tinted panel for a standout offer — both text and images are set by
 *  the admin (Design Studio → Hero), nothing here is hardcoded per store. */
export function StoreHero({
  tenant,
  tenantId,
  storeName,
  template,
  design,
  section,
  products,
  categories,
}: {
  tenant: string;
  tenantId?: string;
  storeName: string;
  template: StoreTemplate;
  design: StoreDesignConfig;
  section: StoreSectionConfig;
  products: Product[];
  categories: Category[];
}) {
  const title = typeof section.data.title === 'string' && section.data.title ? section.data.title : template.heroTitle;
  const accent = typeof section.data.accent === 'string' && section.data.accent ? section.data.accent : template.heroAccent;
  const body = typeof section.data.body === 'string' && section.data.body ? section.data.body : design.global.tagline;
  const mediaUrl = (id: unknown) => typeof id === 'string' && id && tenantId ? `${process.env.NEXT_PUBLIC_ECOM_API_URL ?? 'http://localhost:4001'}/v1/storefront/${tenantId}/media/${id}` : '';
  const heroImage = mediaUrl(section.data.mediaId);
  const badge = typeof section.data.badge === 'string' ? section.data.badge : '';
  const badgeSub = typeof section.data.badgeSub === 'string' ? section.data.badgeSub : '';

  const secondaryTitle = typeof section.data.secondaryTitle === 'string' && section.data.secondaryTitle ? section.data.secondaryTitle : 'Limited time deals';
  const secondaryBody = typeof section.data.secondaryBody === 'string' && section.data.secondaryBody ? section.data.secondaryBody : 'Save on a curated set of products this week.';
  const secondaryImage = mediaUrl(section.data.secondaryMediaId);

  return (
    <section className={`store-hero store-hero-${template.heroLayout}`}>
      <div className="store-hero-panel store-hero-panel-primary" style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}>
        <div className="store-hero-copy">
          <p className="store-hero-eyebrow">{template.eyebrow} · {storeName}</p>
          <h1><span data-design-field="title">{title}</span><br /><span data-design-field="accent">{accent}</span></h1>
          <p className="store-hero-note" data-design-field="body">{body}</p>
          <a href="#collection" className="store-hero-cta">Shop now <span aria-hidden>↘</span></a>
        </div>
      </div>

      <div className="store-hero-panel store-hero-panel-secondary" style={secondaryImage ? { backgroundImage: `url(${secondaryImage})` } : undefined}>
        {badge && (
          <span className="store-hero-badge" aria-hidden>
            <strong>{badge}</strong>
            {badgeSub && <small>{badgeSub}</small>}
          </span>
        )}
        <div className="store-hero-copy">
          <p className="store-hero-eyebrow" data-design-field="secondaryTitle">{secondaryTitle}</p>
          <p className="store-hero-note" data-design-field="secondaryBody">{secondaryBody}</p>
        </div>
        <a href="#collection" className="store-hero-cta store-hero-cta-ghost">Shop now <span aria-hidden>↘</span></a>
      </div>

      {categories.length > 0 && (
        <nav className="store-hero-categories" aria-label="Featured categories">
          {categories.slice(0, 5).map((category) => (
            <Link key={category.id} href={`/${tenant}?category=${category.id}`}>
              <span>{category.name}</span><span aria-hidden>↗</span>
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
