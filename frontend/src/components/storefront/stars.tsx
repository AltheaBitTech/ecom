import type { Product } from '@/lib/types';

/** Reads an admin-set rating from custom_attributes. ponytail: ratings are
 *  merchant-entered (rating 0–5 + rating_count); customer-submitted reviews
 *  need a backend review model. */
export function productRating(product: Product): { value: number; count: number } | null {
  const attrs = product.custom_attributes ?? {};
  const value = Number(attrs.rating);
  if (!Number.isFinite(value) || value <= 0) return null;
  const count = Number(attrs.rating_count);
  return { value: Math.min(5, Math.max(0, value)), count: Number.isFinite(count) ? count : 0 };
}

export function Stars({ product, className = '' }: { product: Product; className?: string }) {
  const rating = productRating(product);
  if (!rating) return null;
  const rounded = Math.round(rating.value * 2) / 2; // nearest half
  return (
    <span className={`store-stars ${className}`} aria-label={`Rated ${rating.value} out of 5`}>
      <span className="store-stars-glyphs" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= rounded ? 'is-full' : i - 0.5 === rounded ? 'is-half' : ''}>★</span>
        ))}
      </span>
      {rating.count > 0 && <small>({rating.count})</small>}
    </span>
  );
}
