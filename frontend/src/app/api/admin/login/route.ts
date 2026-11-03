import { NextResponse } from 'next/server';

import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_STORE_COOKIE,
  ADMIN_STORE_SLUG_COOKIE,
  ADMIN_TENANT_COOKIE,
  REFRESH_MAX_AGE,
  STAFF_REFRESH_COOKIE,
  readSetCookie,
} from '@/lib/admin-auth';

/**
 * Staff sign-in (Backend-for-Frontend). Turns a merchant-friendly store slug plus
 * credentials into a session: it resolves the slug to a tenant id, forwards the
 * credentials to the ecom backend, and — on success — re-homes the returned
 * tokens into httpOnly cookies this Next server controls. Credentials and tokens
 * never reach the browser JS; only the outcome does.
 */
const BASE = process.env.ECOM_API_URL ?? 'http://localhost:4001';

const isProd = process.env.NODE_ENV === 'production';

interface LoginBody {
  slug?: string;
  email?: string;
  password?: string;
}

export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: { code: 'bad_request', message: 'Invalid request body' } }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim().toLowerCase();
  const email = (body.email ?? '').trim();
  const password = body.password ?? '';
  if (!slug || !email || !password) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Store, email and password are required' } },
      { status: 400 },
    );
  }

  // 1) slug → tenant id (public resolver).
  const lookupRes = await fetch(`${BASE}/v1/stores/lookup?slug=${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  if (!lookupRes.ok) {
    return NextResponse.json(
      { error: { code: 'store_not_found', message: `No store found for "${slug}"` } },
      { status: 404 },
    );
  }
  const lookup = (await lookupRes.json()) as { data: { tenant_id: string; store_name: string } };
  const tenantId = lookup.data.tenant_id;
  const storeName = lookup.data.store_name;

  // 2) forward credentials to the tenant-scoped staff login.
  const loginRes = await fetch(`${BASE}/v1/admin/${tenantId}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  const payload = (await loginRes.json().catch(() => null)) as
    | { data?: { access_token?: string; expires_in?: number; mfa_required?: boolean; tenant_selection_required?: boolean } }
    | { error?: { code?: string; message?: string } }
    | null;

  if (!loginRes.ok) {
    const err = (payload as { error?: { code?: string; message?: string } })?.error;
    return NextResponse.json(
      { error: { code: err?.code ?? 'login_failed', message: err?.message ?? 'Sign in failed' } },
      { status: loginRes.status },
    );
  }

  const data = (payload as { data?: Record<string, unknown> })?.data ?? {};
  const accessToken = data.access_token as string | undefined;

  // MFA or multi-tenant selection: no token yet — surface the step, set nothing.
  if (!accessToken) {
    return NextResponse.json({ data }, { status: 200 });
  }

  const expiresIn = typeof data.expires_in === 'number' ? (data.expires_in as number) : 900;
  const refreshToken = readSetCookie(loginRes.headers.getSetCookie(), STAFF_REFRESH_COOKIE);

  const res = NextResponse.json({ ok: true }, { status: 200 });
  const secureBase = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };

  res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, { ...secureBase, maxAge: expiresIn });
  res.cookies.set(ADMIN_TENANT_COOKIE, tenantId, { ...secureBase, maxAge: REFRESH_MAX_AGE });
  // Store name is chrome, not a secret — readable is fine, but keep it httpOnly
  // for consistency; the layout reads it server-side.
  res.cookies.set(ADMIN_STORE_COOKIE, storeName, { ...secureBase, maxAge: REFRESH_MAX_AGE });
  res.cookies.set(ADMIN_STORE_SLUG_COOKIE, slug, { ...secureBase, maxAge: REFRESH_MAX_AGE });
  if (refreshToken) {
    res.cookies.set(STAFF_REFRESH_COOKIE, refreshToken, { ...secureBase, maxAge: REFRESH_MAX_AGE });
  }
  return res;
}
