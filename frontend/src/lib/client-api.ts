/**
 * Browser-side client for the ecom backend, used by storefront client components
 * (cart, checkout, account). The backend is always the security boundary; this is
 * a thin typed wrapper that unwraps the `{ data, meta }` envelope and normalises
 * errors.
 *
 * `credentials: 'include'` is always sent so the httpOnly customer refresh cookie
 * (set by the backend on the same site) travels with account/auth requests. A
 * customer access token, when present, is passed explicitly as a Bearer header by
 * the account provider — it is never read from a cookie here.
 */
const BASE = process.env.NEXT_PUBLIC_ECOM_API_URL ?? 'http://localhost:4001';
const tenantIds = new Map<string, Promise<string>>();

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'code' in e && 'status' in e;
}

type ClientOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

async function resolveStorefrontPath(path: string): Promise<string> {
  const match = path.match(/^\/storefront\/([^/]+)(\/.*)?$/);
  if (!match) return path;

  const slug = decodeURIComponent(match[1]);
  let pending = tenantIds.get(slug);
  if (!pending) {
    pending = fetch(`${BASE}/v1/stores/lookup?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw { code: 'store_not_found', message: 'Store not found', status: res.status } satisfies ApiError;
        const body = (await res.json()) as { data?: { tenant_id?: string } };
        const tenantId = body.data?.tenant_id;
        if (!tenantId) throw { code: 'store_not_found', message: 'Store not found', status: 404 } satisfies ApiError;
        return tenantId;
      })
      .catch((error) => {
        tenantIds.delete(slug);
        throw error;
      });
    tenantIds.set(slug, pending);
  }

  return `/storefront/${await pending}${match[2] ?? ''}`;
}

export async function clientApi<T>(path: string, opts: ClientOpts = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const resolvedPath = await resolveStorefrontPath(path);
  const res = await fetch(`${BASE}/v1${resolvedPath}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    let code = 'error';
    let message = res.statusText || 'Request failed';
    try {
      const parsed = (await res.json()) as { error?: { code?: string; message?: string } };
      code = parsed.error?.code ?? code;
      message = parsed.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    const err: ApiError = { code, message, status: res.status };
    throw err;
  }

  if (res.status === 204) return undefined as T;

  const parsed = (await res.json()) as { data?: T } | T;
  if (parsed && typeof parsed === 'object' && 'data' in parsed && 'meta' in (parsed as object)) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}
