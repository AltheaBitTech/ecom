'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { CartItem } from '@/lib/types';

/**
 * The cart lives entirely in the browser (localStorage), keyed per store so two
 * tenants on the same origin never share a basket. It holds only product id +
 * quantity + a display snapshot; the backend re-prices every line at preview and
 * checkout, so a stale snapshot can never change what a shopper is charged.
 */
interface CartContextValue {
  items: CartItem[];
  count: number;
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

const keyFor = (tenant: string) => `ecom.cart.${tenant}`;

export function CartProvider({ tenant, children }: { tenant: string; children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage once on mount (client only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(keyFor(tenant));
      // Must start empty and hydrate here, not via a lazy initializer: reading
      // localStorage during the initial render would mismatch the server's
      // empty-cart HTML and trip a hydration error.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* corrupt/absent cart — start empty */
    }
    setReady(true);
  }, [tenant]);

  // Persist on every change (after hydration, so we never clobber with []).
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(keyFor(tenant), JSON.stringify(items));
    } catch {
      /* storage full/blocked — cart still works in-memory this session */
    }
  }, [items, ready, tenant]);

  const add = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id
            ? { ...i, quantity: Math.min(999, i.quantity + quantity) }
            : i,
        );
      }
      return [...prev, { ...item, quantity: Math.min(999, Math.max(1, quantity)) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product_id !== productId)
        : prev.map((i) =>
            i.product_id === productId ? { ...i, quantity: Math.min(999, quantity) } : i,
          ),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
      ready,
    }),
    [items, add, setQuantity, remove, clear, ready],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
