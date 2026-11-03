/**
 * Admin (staff) session cookies and the small pure helpers that the sign-in
 * route handlers and the refresh middleware share.
 *
 * The Next.js server acts as a Backend-for-Frontend: it owns these httpOnly
 * cookies, forwarding the access token to the ecom backend as a Bearer and
 * exchanging the refresh token when the access token expires. The admin browser
 * never sees a token. This module holds ONLY constants and framework-free helpers
 * so it is safe to import from both Route Handlers (Node runtime) and middleware
 * (Edge runtime) — no `next/headers`, no `server-only`.
 */

/** Short-lived staff access JWT. Decoded (never verified) client-of-server-side
 *  for the session; the backend verifies it on every call. */
export const ACCESS_TOKEN_COOKIE = 'ecom_access_token';
/** Long-lived opaque refresh token, re-homed from the backend onto path `/`. */
export const STAFF_REFRESH_COOKIE = 'ecom_staff_refresh';
/** The signed-in store's tenant id — needed to build the tenant-scoped backend
 *  auth path during a refresh, when the access token may already be gone. */
export const ADMIN_TENANT_COOKIE = 'ecom_admin_tenant';
/** The store's display name (non-sensitive) for dashboard chrome. */
export const ADMIN_STORE_COOKIE = 'ecom_admin_store';
/** Public store slug, used only to build the dashboard's "View store" link. */
export const ADMIN_STORE_SLUG_COOKIE = 'ecom_admin_store_slug';

/** 30 days, matching the backend staff refresh cookie lifetime. */
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Pull a named cookie's value out of a response's Set-Cookie header(s). The ecom
 * backend sets its refresh cookie scoped to its own auth path; the BFF re-homes
 * the value onto a cookie it controls, so it only needs the raw value.
 */
export function readSetCookie(setCookies: string[], name: string): string | null {
  for (const line of setCookies) {
    const first = line.split(';', 1)[0];
    const eq = first.indexOf('=');
    if (eq === -1) continue;
    if (first.slice(0, eq).trim() === name) {
      return decodeURIComponent(first.slice(eq + 1).trim());
    }
  }
  return null;
}

export interface RefreshedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string | null;
}

/**
 * Exchange a staff refresh token for a fresh access token via the backend. The
 * backend reads the refresh from a cookie, so we present it as one; it returns a
 * new access token in the body and (rotating) a new refresh via Set-Cookie.
 * Framework-free so both the refresh Route Handler and the Edge middleware can
 * call it. Returns null on any failure (caller should then force re-auth).
 */
export async function refreshStaffTokens(
  tenantId: string,
  refreshToken: string,
): Promise<RefreshedTokens | null> {
  const base = process.env.ECOM_API_URL ?? 'http://localhost:4001';
  try {
    const res = await fetch(`${base}/v1/admin/${tenantId}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `${STAFF_REFRESH_COOKIE}=${refreshToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as
      | { data?: { access_token?: string; expires_in?: number } }
      | null;
    const accessToken = payload?.data?.access_token;
    if (!accessToken) return null;
    return {
      accessToken,
      expiresIn: typeof payload?.data?.expires_in === 'number' ? payload.data.expires_in : 900,
      refreshToken: readSetCookie(res.headers.getSetCookie?.() ?? [], STAFF_REFRESH_COOKIE),
    };
  } catch {
    return null;
  }
}

/**
 * True when a JWT is missing, unparseable, or expires within `skewSeconds`.
 * Decode only — the backend is the verifier; this just decides whether the BFF
 * should refresh before rendering.
 */
export function isTokenExpiring(token: string | undefined, skewSeconds = 30): boolean {
  if (!token) return true;
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  try {
    // base64url → base64, pad, then atob (available in both Edge and Node
    // runtimes; JWT claims here are ASCII so a plain decode is sufficient).
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}
