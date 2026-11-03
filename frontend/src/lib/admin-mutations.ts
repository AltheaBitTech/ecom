import 'server-only';

import { cookies } from 'next/headers';

import { ACCESS_TOKEN_COOKIE } from './admin-auth';

/**
 * Server-only helper for admin WRITES. The staff access token is httpOnly, so
 * mutations cannot originate in the browser — they run in Server Actions that
 * call this, which reads the cookie and forwards it to the ecom backend as a
 * Bearer. The backend re-verifies the token and the permission on every call.
 *
 * Returns a discriminated result (never throws on HTTP errors) so actions can
 * surface a friendly message to the form.
 */
const BASE = process.env.ECOM_API_URL ?? 'http://localhost:4001';

export interface MutationResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code: string; message: string };
}

export async function backendMutate<T = unknown>(
  path: string,
  opts: { method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown },
): Promise<MutationResult<T>> {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1${path}`, {
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0, error: { code: 'network', message: 'Could not reach the server.' } };
  }

  if (res.status === 204) return { ok: true, status: 204 };

  const json = (await res.json().catch(() => null)) as
    | { data?: T; error?: { code?: string; message?: string } }
    | null;

  if (!res.ok) {
    const e = json?.error;
    return {
      ok: false,
      status: res.status,
      error: { code: e?.code ?? 'error', message: e?.message ?? 'Request failed' },
    };
  }

  const data =
    json && typeof json === 'object' && 'data' in json ? (json as { data: T }).data : (json as T);
  return { ok: true, status: res.status, data };
}
