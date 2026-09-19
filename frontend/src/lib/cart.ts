'use client';

import { useSyncExternalStore } from 'react';

let STORAGE_KEY = 'storefront_cart';
export function cartStorageKey() { return STORAGE_KEY; }
export function setCartScope(storeId: string, migrateLegacy = false) {
  STORAGE_KEY = `storefront_cart:${storeId}`;
  if (migrateLegacy) {
    try {
      const legacy = localStorage.getItem('storefront_cart');
      if (legacy && localStorage.getItem(STORAGE_KEY) === null) localStorage.setItem(STORAGE_KEY, legacy);
    } catch { /* Storage may be unavailable. */ }
  }
  emitChange();
}

// variantId is undefined for a product with no variants; a product WITH variants is always
// added by a specific variant, so (productId, variantId) together identify a distinct line —
// "Sandwich / Half" and "Sandwich / Full" are separate lines, not one line with two prices.
export interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
}

function sameLine(a: Pick<CartLine, 'productId' | 'variantId'>, b: Pick<CartLine, 'productId' | 'variantId'>) {
  return a.productId === b.productId && a.variantId === b.variantId;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach((l) => l());
}

export function getCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        l &&
        typeof l.productId === 'string' &&
        (l.variantId === undefined || typeof l.variantId === 'string') &&
        typeof l.quantity === 'number' &&
        Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= 999,
    );
  } catch {
    return [];
  }
}

function saveCart(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // private browsing / quota exceeded — cart just won't persist this write
  }
  emitChange();
}

export function addToCart(productId: string, variantId: string | undefined, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity < 1) return;
  const lines = getCart();
  const existing = lines.find((l) => sameLine(l, { productId, variantId }));
  if (existing) existing.quantity = Math.min(999, existing.quantity + quantity);
  else lines.push({ productId, variantId, quantity: Math.min(999, quantity) });
  saveCart(lines);
}

export function updateQuantity(productId: string, variantId: string | undefined, quantity: number) {
  const lines = getCart();
  if (quantity <= 0) {
    saveCart(lines.filter((l) => !sameLine(l, { productId, variantId })));
    return;
  }
  const existing = lines.find((l) => sameLine(l, { productId, variantId }));
  if (existing && Number.isInteger(quantity)) existing.quantity = Math.min(999, quantity);
  saveCart(lines);
}

export function removeFromCart(productId: string, variantId?: string) {
  saveCart(getCart().filter((l) => !sameLine(l, { productId, variantId })));
}

export function clearCart() {
  saveCart([]);
}

export function getCartTotal(items: { priceCents: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function getServerSnapshot(): string {
  return '[]';
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  // Picks up changes made in other tabs; same-tab changes go through emitChange().
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Live cart lines — re-renders on any addToCart/updateQuantity/removeFromCart/clearCart, in this tab or another. */
export function useCartLines(): CartLine[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line): line is CartLine => line && typeof line.productId === 'string' && (line.variantId === undefined || typeof line.variantId === 'string') && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999);
  } catch {
    return [];
  }
}

export function useCartCount(): number {
  return useCartLines().reduce((sum, l) => sum + l.quantity, 0);
}
