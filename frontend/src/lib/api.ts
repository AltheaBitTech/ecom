const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Access token lives in memory only — never localStorage, never a JS-readable cookie.
// A hard refresh loses it; the AuthProvider silently rehydrates via the httpOnly
// refresh cookie on mount. See lib/auth-context.tsx.
let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Which tenant's public storefront this browser tab is shopping. Sent only on public /storefront/*
// calls (see StoreProvider); the backend falls back to its default store when it's absent.
let storeSlug: string | null = null;
export function setStoreSlug(slug: string | null) {
  storeSlug = slug;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return false;
      const body = await res.json();
      setAccessToken(body.accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuthRetry?: boolean;
}

/** Fetch wrapper: attaches the in-memory access token, retries once through a silent refresh on 401. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(storeSlug && path.startsWith('/storefront') && !path.startsWith('/storefront/admin') ? { 'x-store-slug': storeSlug } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !opts.skipAuthRetry) {
    const ok = await tryRefresh();
    if (ok) return api<T>(path, { ...opts, skipAuthRetry: true });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Downloads a binary response (e.g. a PDF) with the same auth header/refresh-retry as api(), and saves it via a throwaway blob link. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) return apiDownload(path, filename);
  }
  if (!res.ok) throw new ApiError(res.status, 'Download failed');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export { API_URL, tryRefresh };
