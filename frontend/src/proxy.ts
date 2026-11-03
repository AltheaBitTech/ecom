import { NextResponse, type NextRequest } from 'next/server';

import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_STORE_COOKIE,
  ADMIN_STORE_SLUG_COOKIE,
  ADMIN_TENANT_COOKIE,
  REFRESH_MAX_AGE,
  STAFF_REFRESH_COOKIE,
  isTokenExpiring,
  refreshStaffTokens,
} from '@/lib/admin-auth';

/**
 * Keeps admin (staff) sessions alive across the short-lived access token. Before
 * an admin page renders, if the access token is missing or about to expire but a
 * refresh token is present, we exchange it silently and hand the request a fresh
 * cookie — so a merchant never gets bounced to sign-in mid-task. With no usable
 * refresh, we redirect to sign-in. The sign-in page itself is exempt.
 *
 * This is convenience/continuity only: the backend independently verifies every
 * token and re-checks every permission on each call.
 */
const isProd = process.env.NODE_ENV === 'production';

export async function proxy(req: NextRequest) {
  const access = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!isTokenExpiring(access)) {
    return NextResponse.next();
  }

  const refresh = req.cookies.get(STAFF_REFRESH_COOKIE)?.value;
  const tenantId = req.cookies.get(ADMIN_TENANT_COOKIE)?.value;

  if (refresh && tenantId) {
    const refreshed = await refreshStaffTokens(tenantId, refresh);
    if (refreshed) {
      // Rewrite the REQUEST cookie header so the downstream server component or
      // Server Action reads the fresh token on THIS request (request cookies
      // wouldn't otherwise reflect a cookie set on the response), and also set it
      // on the response so the browser persists it. Works for GET and POST alike.
      const rebuilt = req.cookies
        .getAll()
        .map((c) => {
          if (c.name === ACCESS_TOKEN_COOKIE) return `${c.name}=${refreshed.accessToken}`;
          if (c.name === STAFF_REFRESH_COOKIE && refreshed.refreshToken)
            return `${c.name}=${refreshed.refreshToken}`;
          return `${c.name}=${c.value}`;
        });
      if (!req.cookies.has(ACCESS_TOKEN_COOKIE)) rebuilt.push(`${ACCESS_TOKEN_COOKIE}=${refreshed.accessToken}`);

      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('cookie', rebuilt.join('; '));
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      const opts = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
      res.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken, { ...opts, maxAge: refreshed.expiresIn });
      if (refreshed.refreshToken) {
        res.cookies.set(STAFF_REFRESH_COOKIE, refreshed.refreshToken, { ...opts, maxAge: REFRESH_MAX_AGE });
      }
      return res;
    }
  }

  // No usable session — send to sign-in and clear stale cookies.
  const signIn = new URL('/admin/sign-in', req.url);
  const res = NextResponse.redirect(signIn);
  for (const name of [ACCESS_TOKEN_COOKIE, STAFF_REFRESH_COOKIE, ADMIN_TENANT_COOKIE, ADMIN_STORE_COOKIE, ADMIN_STORE_SLUG_COOKIE]) {
    res.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return res;
}

/**
 * Run only on dashboard routes. Excludes the sign-in page and the BFF auth
 * endpoints (which manage cookies themselves), plus Next internals and assets.
 */
export const config = {
  matcher: ['/admin', '/admin/((?!sign-in).*)'],
};
