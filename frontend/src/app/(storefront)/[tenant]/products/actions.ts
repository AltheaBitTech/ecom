'use server';

import { ecomApi } from '@/lib/api';
import type { Product } from '@/lib/types';

const PAGE_SIZE = 24;

/** Append-pagination for the storefront catalog: given the active filters and a
 *  keyset cursor, return the next page + the following cursor (null when done). */
export async function fetchMoreProducts(
  tenant: string,
  filters: { category?: string; q?: string; sort?: string },
  cursor: string,
): Promise<{ products: Product[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (filters.category) query.set('category_id', filters.category);
  if (filters.q) query.set('q', filters.q);
  query.set('sort', filters.sort ?? 'newest');
  query.set('limit', String(PAGE_SIZE));
  query.set('cursor', cursor);
  try {
    const store = await ecomApi.resolveStore(tenant);
    const page = await ecomApi.storefrontProducts(store.tenant_id, `?${query}`);
    return { products: page.data, nextCursor: page.has_more ? page.next_cursor : null };
  } catch {
    return { products: [], nextCursor: null };
  }
}
