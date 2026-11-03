'use client';

import { useState } from 'react';

import type { Product } from '@/lib/types';

import { AddToCart } from './add-to-cart';

/** Reads weight/size options from custom_attributes.variants (array of labels),
 *  falling back to a single custom_attributes.weight. Selection is display-only
 *  and appended to the cart line — see CartItem.variant ceiling. */
export function variantOptions(product: Product): string[] {
  const attrs = product.custom_attributes ?? {};
  if (Array.isArray(attrs.variants)) return attrs.variants.map((v) => String(v)).filter(Boolean);
  if (typeof attrs.weight === 'string' && attrs.weight) return [attrs.weight];
  return [];
}

export function ProductPurchase({ tenant, product }: { tenant: string; product: Product }) {
  const options = variantOptions(product);
  const [selected, setSelected] = useState(options[0]);

  return (
    <div className="store-purchase">
      {options.length > 1 && (
        <div className="store-variants" role="group" aria-label="Choose size">
          <span className="store-variants-label">Size</span>
          <div className="store-variants-options">
            {options.map((option) => (
              <button key={option} type="button" onClick={() => setSelected(option)} aria-pressed={selected === option} className={selected === option ? 'is-selected' : ''}>{option}</button>
            ))}
          </div>
        </div>
      )}
      <AddToCart tenant={tenant} product={product} variant={options.length ? selected : undefined} />
    </div>
  );
}
