import 'server-only';

import { cookies } from 'next/headers';

import { ACCESS_TOKEN_COOKIE } from './admin-auth';

/**
 * Server-side client for the ecom backend. Runs only in Server Components / Route
 * Handlers, never in the browser, so it can forward the httpOnly access-token
 * cookie as a Bearer credential. The backend remains the security boundary; this
 * is a convenience wrapper with typed helpers.
 */
const BASE = process.env.ECOM_API_URL ?? 'http://localhost:4001';

export { ACCESS_TOKEN_COOKIE };

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

interface StoreLookup {
  tenant_id: string;
  slug: string;
  store_name: string;
}

type FetchOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // attach the caller's bearer token
  revalidate?: number | false;
};

async function api<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (opts.auth) {
    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/v1${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    next: opts.revalidate === undefined ? undefined : { revalidate: opts.revalidate || 0 },
    cache: opts.revalidate === false ? 'no-store' : undefined,
  });

  if (!res.ok) {
    let code = 'error';
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    const err: ApiError = { code, message, status: res.status };
    throw err;
  }

  if (res.status === 204) return undefined as T;

  // The backend wraps every success as { data, meta }. Unwrap to the payload;
  // a paginated payload keeps its own { data, next_cursor, has_more } shape.
  const body = (await res.json()) as { data?: T } | T;
  if (body && typeof body === 'object' && 'data' in body && 'meta' in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const ecomApi = {
  resolveStore: (slug: string) =>
    api<StoreLookup>(`/stores/lookup?slug=${encodeURIComponent(slug)}`, { revalidate: 60 }),
  // Public storefront reads (no auth) — cached briefly.
  storefrontConfig: (tenantId: string, previewToken?: string) =>
    api<import('./types').StoreConfig>(`/storefront/${tenantId}/config${previewToken ? `?preview_token=${encodeURIComponent(previewToken)}` : ''}`, { revalidate: previewToken ? false : 60 }),
  storefrontProducts: (tenantId: string, query = '') =>
    api<import('./types').Page<import('./types').Product>>(
      `/storefront/${tenantId}/products${query}`,
      { revalidate: 30 },
    ),
  storefrontProduct: (tenantId: string, id: string) =>
    api<import('./types').Product>(`/storefront/${tenantId}/products/${id}`, { revalidate: 30 }),
  storefrontCategories: (tenantId: string) =>
    api<import('./types').Category[]>(`/storefront/${tenantId}/categories`, { revalidate: 60 }),
  storefrontFlashSales: (tenantId: string) =>
    api<import('./types').ActiveFlashSale[]>(`/storefront/${tenantId}/flash-sales/active`, { revalidate: 30 }),

  // Admin reads (bearer) — never cached.
  adminProducts: (tenantId: string, query = '') =>
    api<import('./types').Page<import('./types').Product>>(`/tenants/${tenantId}/products${query}`, {
      auth: true,
      revalidate: false,
    }),
  adminProduct: (tenantId: string, id: string) =>
    api<import('./types').Product>(`/tenants/${tenantId}/products/${id}`, {
      auth: true,
      revalidate: false,
    }),
  adminCategories: (tenantId: string) =>
    api<import('./types').Category[]>(`/tenants/${tenantId}/categories`, {
      auth: true,
      revalidate: false,
    }),
  adminOrders: (tenantId: string, query = '') =>
    api<import('./types').Page<import('./types').Order>>(`/tenants/${tenantId}/orders${query}`, {
      auth: true,
      revalidate: false,
    }),
  adminFlashSales: (tenantId: string) =>
    api<import('./types').FlashSale[]>(`/tenants/${tenantId}/flash-sales`, {
      auth: true,
      revalidate: false,
    }),
  entitlements: (tenantId: string) =>
    api<import('./types').Entitlements>(`/tenants/${tenantId}/billing/entitlements`, {
      auth: true,
      revalidate: false,
    }),
  storeSettings: (tenantId: string) =>
    api<import('./types').StoreConfig>(`/tenants/${tenantId}/settings`, {
      auth: true,
      revalidate: false,
    }),
  storeDesign: (tenantId: string) =>
    api<import('./types').StoreDesignState>(`/tenants/${tenantId}/design`, { auth: true, revalidate: false }),
  mediaAssets: (tenantId: string) =>
    api<import('./types').MediaAsset[]>(`/tenants/${tenantId}/media`, { auth: true, revalidate: false }),
};

export { api };
