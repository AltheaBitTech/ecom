import type { StorefrontProduct, ProductVariant } from './types';
export const money = (cents: number, currency = 'INR') => (cents / 100).toLocaleString('en-IN', { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
export function price(product: StorefrontProduct, variant?: ProductVariant) {
  const selected = variant ?? product.variants[0];
  const current = selected?.priceCents ?? product.priceCents;
  const original = selected ? selected.compareAtCents : product.compareAtCents;
  return { current, original: original && original > current ? original : null };
}
export function isOnSale(product: StorefrontProduct) {
  return product.variants.length ? product.variants.some((v) => !!v.compareAtCents && v.compareAtCents > v.priceCents) : !!product.compareAtCents && product.compareAtCents > product.priceCents;
}
