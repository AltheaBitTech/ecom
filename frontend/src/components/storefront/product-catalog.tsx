import Link from 'next/link';

import { EmptyState } from '@/components/ui/primitives';
import type { Category, Product } from '@/lib/types';

import { CatalogGrid } from './catalog-grid';
import type { StoreSearch } from './store-sections';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A–Z' },
  { value: 'name_desc', label: 'Name: Z–A' },
];

/**
 * Full "shop all" listing: search + sort + category filter and a responsive
 * grid of every product. Filters are a plain GET form so it works without JS
 * and stays server-rendered. Lives on /[tenant]/products.
 */
export function ProductCatalog({ tenant, products, categories, search, nextCursor }: { tenant: string; products: Product[]; categories: Category[]; search: StoreSearch; nextCursor?: string | null }) {
  const action = `/${tenant}/products`;
  return (
    <section className="store-module store-products-section store-catalog-page">
      <div className="store-catalog-head">
        <div className="store-module-heading"><span>The collection</span><h2>Shop all products</h2></div>
        <p className="store-catalog-count">Showing {products.length} {products.length === 1 ? 'product' : 'products'}</p>
      </div>

      <div className="store-catalog-controls">
        <form method="GET" action={action} className="store-filters">
          <input type="search" name="q" defaultValue={search.q ?? ''} placeholder="Search products" />
          {search.category && <input type="hidden" name="category" value={search.category} />}
          <select name="sort" defaultValue={search.sort ?? 'newest'} aria-label="Sort products">
            {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
          </select>
          <button type="submit">Apply ↗</button>
        </form>
        {categories.length > 0 && (
          <nav aria-label="Product categories" className="store-catalog-chips">
            {/* Real categories only. "All" appears solely to clear an active
                filter — so an unfiltered store shows exactly its own categories. */}
            {search.category && <Chip tenant={tenant} search={search} label="Clear filter" active={false} />}
            {categories.map((category) => <Chip key={category.id} tenant={tenant} search={search} categoryId={category.id} label={category.name} active={search.category === category.id} />)}
          </nav>
        )}
      </div>

      {products.length ? (
        <CatalogGrid tenant={tenant} initial={products} initialCursor={nextCursor ?? null} search={search} />
      ) : (
        <EmptyState icon="✦" title={search.q || search.category ? 'Nothing matched that search' : 'No products yet'} description={search.q || search.category ? 'Try a different category or search term.' : 'There are no published products yet.'} />
      )}
    </section>
  );
}

function Chip({ tenant, search, categoryId, label, active }: { tenant: string; search: StoreSearch; categoryId?: string; label: string; active: boolean }) {
  const query = new URLSearchParams();
  if (categoryId) query.set('category', categoryId);
  if (search.sort) query.set('sort', search.sort);
  if (search.q) query.set('q', search.q);
  return <Link href={`/${tenant}/products${query.size ? `?${query}` : ''}`} aria-current={active ? 'page' : undefined}>{label}</Link>;
}
