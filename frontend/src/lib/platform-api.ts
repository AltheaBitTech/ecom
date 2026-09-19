import { getPlatformToken } from './platform-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class PlatformApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Server-only fetch wrapper for the platform-admin API. The bearer token lives in an
 * httpOnly cookie (see platform-session.ts) so this can only run in Server Components,
 * Route Handlers, or Server Actions — never import it from a 'use client' file.
 */
export async function platformApi<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const token = opts.token ?? (await getPlatformToken());
  if (!token) throw new PlatformApiError(401, 'Not signed in');

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new PlatformApiError(res.status, body.message ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export { API_URL };
