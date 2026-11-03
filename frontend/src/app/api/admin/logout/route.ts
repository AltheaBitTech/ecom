import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_STORE_COOKIE,
  ADMIN_STORE_SLUG_COOKIE,
  ADMIN_TENANT_COOKIE,
  STAFF_REFRESH_COOKIE,
} from '@/lib/admin-auth';

/**
 * Staff sign-out. Best-effort revokes the session at the backend (so the refresh
 * token is invalidated server-side), then clears every admin cookie regardless of
 * that call's outcome — the local session ends even if the backend is unreachable.
 */
const BASE = process.env.ECOM_API_URL ?? 'http://localhost:4001';

export async function POST() {
  const jar = await cookies();
  const tenantId = jar.get(ADMIN_TENANT_COOKIE)?.value;
  const refresh = jar.get(STAFF_REFRESH_COOKIE)?.value;
  const access = jar.get(ACCESS_TOKEN_COOKIE)?.value;

  if (tenantId && refresh) {
    try {
      await fetch(`${BASE}/v1/admin/${tenantId}/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `${STAFF_REFRESH_COOKIE}=${refresh}`,
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        cache: 'no-store',
      });
    } catch {
      /* revoke is best-effort; clearing cookies below still ends the session */
    }
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  for (const name of [ACCESS_TOKEN_COOKIE, STAFF_REFRESH_COOKIE, ADMIN_TENANT_COOKIE, ADMIN_STORE_COOKIE, ADMIN_STORE_SLUG_COOKIE]) {
    res.cookies.set(name, '', { httpOnly: true, path: '/', maxAge: 0 });
  }
  return res;
}
