'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/types';

import { useCart } from './cart-provider';

/**
 * Compact add-to-cart for product cards on grids. Sits above the card's link
 * overlay (z-index) so a click adds without navigating to the product page.
 */
export function QuickAddButton({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  if (product.stock <= 0) return null;
  return (
    <button
      type="button"
      className="store-quickadd-btn"
      aria-label={`Add ${product.name} to cart`}
      onClick={() => {
        add({ product_id: product.id, name: product.name, price_cents: product.price_cents, currency: product.currency, image: product.images?.[0] ?? null }, 1);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1400);
      }}
    >
      {added ? 'Added ✓' : 'Add to cart'}
    </button>
  );
}

/**
 * Adds a product to the browser cart. Disabled when out of stock. On success it
 * offers a quick path to the cart without navigating away, so browsing stays
 * uninterrupted.
 */
export function AddToCart({ tenant, product, variant }: { tenant: string; product: Product; variant?: string }) {
  const { add } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;

  function handleAdd() {
    add(
      {
        product_id: product.id,
        name: variant ? `${product.name} · ${variant}` : product.name,
        price_cents: product.price_cents,
        currency: product.currency,
        image: product.images?.[0] ?? null,
        variant,
      },
      1,
    );
    setAdded(true);
  }

  if (soldOut) {
    return (
      <Button size="lg" variant="secondary" className="w-full sm:w-auto" disabled>
        Out of stock
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" className="w-full sm:w-auto" onClick={handleAdd}>
        {added ? 'Added ✓' : 'Add to cart'}
      </Button>
      {added && (
        <Button
          size="lg"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => router.push(`/${tenant}/cart`)}
        >
          View cart
        </Button>
      )}
    </div>
  );
}
