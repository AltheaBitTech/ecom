import { ProductCatalog } from '@/components/storefront/product-catalog';
import type { StoreSearch } from '@/components/storefront/store-sections';
import { ecomApi } from '@/lib/api';
import type { Category, Product } from '@/lib/types';

const PAGE_SIZE = 24;

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<StoreSearch & { cursor?: string }> }) {
  const { tenant } = await params;
  const search = await searchParams;
  const query = new URLSearchParams();
  if (search.category) query.set('category_id', search.category);
  if (search.q) query.set('q', search.q);
  query.set('sort', search.sort ?? 'newest');
  query.set('limit', String(PAGE_SIZE));
  if (search.cursor) query.set('cursor', search.cursor);

  let products: Product[] = [];
  let categories: Category[] = [];
  let nextCursor: string | null = null;
  try {
    const store = await ecomApi.resolveStore(tenant);
    const [page, cats] = await Promise.all([
      ecomApi.storefrontProducts(store.tenant_id, `?${query}`),
      ecomApi.storefrontCategories(store.tenant_id).catch(() => []),
    ]);
    products = page.data;
    nextCursor = page.has_more ? page.next_cursor : null;
    categories = cats;
  } catch { /* empty listing renders below */ }

  return <ProductCatalog tenant={tenant} products={products} categories={categories} search={search} nextCursor={nextCursor} />;
}
