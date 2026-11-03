import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';

import { HeaderActions } from '@/components/storefront/header-actions';
import { StorefrontProviders } from '@/components/storefront/storefront-providers';
import { StoreMotion } from '@/components/storefront/store-motion';
import { ecomApi } from '@/lib/api';
import { getStoreTemplate, normalizeStoreDesign } from '@/lib/store-templates';
import { themeStyle } from '@/lib/theme';

/**
 * Per-store storefront chrome. Loads the tenant's config and applies its saved
 * theme (brand colors) as CSS variables on the root — the same component tree,
 * re-skinned per tenant at request time. Mobile-first: most shoppers arrive on
 * a phone.
 */
export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  let config;
  try {
    const store = await ecomApi.resolveStore(tenant);
    const previewToken = (await cookies()).get('ecom_store_preview')?.value;
    config = await ecomApi.storefrontConfig(store.tenant_id, previewToken);
  } catch {
    notFound();
  }

  const design = normalizeStoreDesign(config.theme);
  const template = getStoreTemplate(design.templateId);
  const logoUrl = design.global.logoMediaId ? `${process.env.NEXT_PUBLIC_ECOM_API_URL ?? 'http://localhost:4001'}/v1/storefront/${config.tenant_id}/media/${design.global.logoMediaId}` : null;

  return (
    <StorefrontProviders tenant={tenant}>
      <div data-template={template.id} data-style={template.style} data-chrome={template.chrome} data-product-layout={template.productLayout} data-density={design.tokens.density} style={themeStyle(config.theme)} className="storefront-shell min-h-screen bg-[#f3efe7] text-[#151517]">
        <div className="bg-brand px-5 py-2 text-center text-[9px] font-bold uppercase tracking-[.18em] text-brand-fg">
          {design.global.announcement || 'Free shipping on qualifying orders'} <span className="mx-2 opacity-50">✦</span> Secure checkout
        </div>
        {config.preview && <div className="store-preview-banner"><span>Private draft preview · not live</span><Link href={`/api/storefront-preview?clear=1&slug=${tenant}`}>Exit preview ↗</Link></div>}
        <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f3efe7]/88 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-344 items-center justify-between px-5 sm:px-8">
            <Link href={`/${tenant}`} className="flex items-center gap-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={config.store_name} className="h-9 w-auto" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-fg">
                  {config.store_name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-display text-lg font-bold tracking-[-.04em] sm:text-xl">{config.store_name}<span className="text-brand">.</span></span>
            </Link>
            <nav className="hidden items-center gap-7 text-[10px] font-bold uppercase tracking-[.14em] md:flex" aria-label="Store navigation">
              {(design.global.navigation.length ? design.global.navigation : [{ label: 'Shop all', href: `/${tenant}/products` }, { label: 'New arrivals', href: `/${tenant}/products?sort=newest` }, { label: 'Orders', href: `/${tenant}/account` }]).map((item) => item.children?.length ? (
                <div key={`${item.label}-${item.href}`} className="group relative">
                  <Link href={item.href} className="store-nav-link">{item.label} ▾</Link>
                  <div className="invisible absolute left-1/2 top-full z-30 -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100">
                    <div className="flex min-w-40 flex-col gap-1 rounded-xl border border-black/10 bg-white p-3 normal-case tracking-normal shadow-lift">
                      {item.children.map((child) => <Link key={`${child.label}-${child.href}`} href={child.href} className="rounded-lg px-3 py-2 text-xs font-semibold text-ink hover:bg-paper-soft">{child.label}</Link>)}
                    </div>
                  </div>
                </div>
              ) : <Link key={`${item.label}-${item.href}`} href={item.href} className="store-nav-link">{item.label}</Link>)}
            </nav>
            <form action={`/${tenant}/products`} method="GET" className="store-header-search hidden lg:flex">
              <label className="sr-only" htmlFor="store-search">Search products</label>
              <input id="store-search" type="search" name="q" placeholder="Search products…" />
              <button type="submit" aria-label="Search"><span aria-hidden>⌕</span></button>
            </form>
            <HeaderActions tenant={tenant} />
          </div>
        </header>

        <main><StoreMotion>{children}</StoreMotion></main>

        <footer className="mt-20 border-t border-black/10 bg-[#f7f5f0] px-5 py-14 text-[#151517] sm:px-8">
          <div className="mx-auto grid max-w-344 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-display text-2xl font-bold tracking-[-.04em]">{design.global.footer.heading || config.store_name}<span className="text-brand">.</span></p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-black/45">{design.global.footer.body || design.global.tagline}</p>
              {design.global.socialLinks.length > 0 && (
                <div className="mt-4 flex gap-3 text-xs font-bold uppercase tracking-wide text-black/50">
                  {design.global.socialLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="hover:text-brand">{link.label}</a>)}
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/40">Shop</p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-black/65">
                <Link href={`/${tenant}/products`} className="hover:text-brand">All products</Link>
                <Link href={`/${tenant}/cart`} className="hover:text-brand">Cart</Link>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/40">My account</p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-black/65">
                <Link href={`/${tenant}/account`} className="hover:text-brand">Profile</Link>
                <Link href={`/${tenant}/orders`} className="hover:text-brand">Order history</Link>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/40">Need help?</p>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-black/65">{design.global.announcement || 'Our team is here to help with anything you need.'}</p>
            </div>
          </div>
          <p className="mx-auto mt-10 max-w-344 text-[10px] uppercase tracking-[.14em] text-black/30">© {new Date().getFullYear()} {config.store_name} · Powered by Commerce</p>
        </footer>
      </div>
    </StorefrontProviders>
  );
}
