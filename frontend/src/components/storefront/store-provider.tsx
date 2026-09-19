'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setStoreSlug } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { setCartScope } from '@/lib/cart';
import type { StoreData } from '@/lib/types';

const Context = createContext<{ slug: string | null; store: StoreData | null; error: string | null; reload: () => void; preview: boolean; cartOpen: boolean; setCartOpen: (value: boolean) => void } | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [preview, setPreview] = useState(false);
  const [store, setStore] = useState<StoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const { status, hasPermission } = useAuth();
  const canPreview = status === 'authenticated' && hasPermission(PERMISSIONS.CATALOG_PRODUCTS_VIEW);
  const reload = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const storeParam = params.get('store');
    // A bare /store visit by a signed-in seller shows THEIR store (authenticated preview), never
    // another tenant's. ?store=<slug> names a specific public store; anonymous + bare uses the default.
    if (!storeParam && params.get('preview') !== '1' && status === 'loading') return; // wait to learn who's visiting
    const isPreview = params.get('preview') === '1' || (!storeParam && canPreview);
    const active = isPreview ? null : storeParam;
    setStoreSlug(active);
    api<StoreData>(isPreview ? '/storefront/admin/preview' : '/storefront', { skipAuthRetry: !isPreview }).then((value) => { setCartScope(value.id, !isPreview); setStore(value); setPreview(isPreview); setSlug(active); setError(null); }).catch(() => setError('We couldn’t load the store. Please try again.'));
  }, [status, canPreview]);
  useEffect(reload, [reload]);
  return <Context.Provider value={{ slug, store, error, reload, preview, cartOpen, setCartOpen }}>{children}</Context.Provider>;
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error('StoreProvider is required');
  return value;
}
export function StoreLoading() {
  const { error, reload } = useStore();
  return <div className="store-container py-20" role={error ? 'alert' : 'status'}>{error ? <div className="store-empty"><h1>Let’s try that again.</h1><p>{error}</p><button className="store-button" onClick={reload}>Reload store</button></div> : <><span className="sr-only">Loading store</span><div className="h-80 animate-pulse rounded-3xl bg-muted" /><div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">{[1,2,3,4].map((n) => <div key={n} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div></>}</div>;
}
