'use client';

import { useState, useTransition } from 'react';

import { fetchMoreProducts } from '@/app/(storefront)/[tenant]/products/actions';
import type { Product } from '@/lib/types';

import { ProductCard } from './product-card';
import type { StoreSearch } from './store-sections';

/** Accumulating "Load more" grid: seeded from the SSR first page, appends
 *  subsequent keyset pages via a server action so nothing is lost on click. */
export function CatalogGrid({ tenant, initial, initialCursor, search }: { tenant: string; initial: Product[]; initialCursor: string | null; search: StoreSearch }) {
  const [products, setProducts] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      const next = await fetchMoreProducts(tenant, { category: search.category, q: search.q, sort: search.sort }, cursor);
      setProducts((current) => [...current, ...next.products]);
      setCursor(next.nextCursor);
    });
  }

  return (
    <>
      <div className="store-product-grid">{products.map((product, index) => <ProductCard key={product.id} tenant={tenant} product={product} index={index} />)}</div>
      {cursor && (
        <div className="store-catalog-pager">
          <button type="button" className="store-shop-all-btn" onClick={loadMore} disabled={pending}>{pending ? 'Loading…' : 'Load more products ↓'}</button>
        </div>
      )}
    </>
  );
}
