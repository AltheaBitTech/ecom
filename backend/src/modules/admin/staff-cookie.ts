import type { CookieOptions, Request, Response } from 'express';

import { AppConfig } from '../../common/config/app-config';

/**
 * The staff (merchant admin) refresh token lives ONLY in an httpOnly cookie on
 * ecom's own origin — never in a response body, never readable by admin JS. ecom
 * holds auth-rbac's opaque refresh token here and replays it to auth-rbac on
 * refresh; it never interprets it. This mirrors the shopper refresh cookie
 * (customer-cookie.ts) but for the admin plane, with a distinct name and path so
 * a signed-in shopper and a signed-in staff member never collide on one origin.
 *
 * The path is scoped to the store's admin auth routes so the browser only sends
 * it where it is used, and two stores on the same origin (local dev's path-based
 * multitenancy) keep independent staff sessions.
 */
export const STAFF_REFRESH_COOKIE = 'ecom_staff_refresh';

function cookiePath(tenantId: string, apiPrefix: string): string {
  const prefix = apiPrefix ? `/${apiPrefix.replace(/^\/+|\/+$/g, '')}` : '';
  return `${prefix}/admin/${tenantId}/auth`;
}

function baseOptions(tenantId: string, config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: cookiePath(tenantId, config.apiPrefix),
  };
}

export function setStaffRefreshCookie(
  res: Response,
  token: string,
  tenantId: string,
  config: AppConfig,
): void {
  res.cookie(STAFF_REFRESH_COOKIE, token, {
    ...baseOptions(tenantId, config),
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d, matching auth-rbac's refresh TTL
  });
}

export function clearStaffRefreshCookie(res: Response, tenantId: string, config: AppConfig): void {
  res.clearCookie(STAFF_REFRESH_COOKIE, baseOptions(tenantId, config));
}

/**
 * Read the refresh token straight from the Cookie header. ecom does not register
 * cookie-parser, so we parse the one cookie we need ourselves.
 */
export function readStaffRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === STAFF_REFRESH_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}
