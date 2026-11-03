import type { CookieOptions, Request, Response } from 'express';

import { AppConfig } from '../../common/config/app-config';

/**
 * The shopper refresh token lives ONLY in an httpOnly cookie on ecom's own
 * origin — never in a response body, never readable by storefront JS. ecom holds
 * auth-rbac's opaque refresh token here and replays it to auth-rbac on refresh;
 * it never needs to interpret it.
 *
 * The cookie path is scoped to the store's account routes so the browser only
 * sends it where it is used, and so two stores on the same origin (local dev's
 * path-based multitenancy) keep independent sessions.
 */
export const CUSTOMER_REFRESH_COOKIE = 'ecom_customer_refresh';

function cookiePath(tenantId: string, apiPrefix: string): string {
  const prefix = apiPrefix ? `/${apiPrefix.replace(/^\/+|\/+$/g, '')}` : '';
  return `${prefix}/storefront/${tenantId}/account`;
}

function baseOptions(tenantId: string, config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: cookiePath(tenantId, config.apiPrefix),
  };
}

export function setCustomerRefreshCookie(
  res: Response,
  token: string,
  tenantId: string,
  config: AppConfig,
): void {
  res.cookie(CUSTOMER_REFRESH_COOKIE, token, {
    ...baseOptions(tenantId, config),
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d, matching auth-rbac's refresh TTL
  });
}

export function clearCustomerRefreshCookie(res: Response, tenantId: string, config: AppConfig): void {
  res.clearCookie(CUSTOMER_REFRESH_COOKIE, baseOptions(tenantId, config));
}

/**
 * Read the refresh token straight from the Cookie header. ecom does not register
 * cookie-parser, so `req.cookies` may be undefined — parse the one cookie we need
 * ourselves rather than pull in app-wide middleware.
 */
export function readCustomerRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === CUSTOMER_REFRESH_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}
