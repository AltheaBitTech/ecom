'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { clientApi, isApiError } from '@/lib/client-api';
import type { CustomerTokens } from '@/lib/types';

/**
 * Shopper session for the storefront. The durable session is the httpOnly refresh
 * cookie the backend set at login (scoped to this store's account routes); this
 * provider holds only the short-lived access token IN MEMORY and silently
 * refreshes it on load and on 401. The token is never written to localStorage, so
 * it is not exposed to casual XSS persistence.
 */
export interface AccountUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface AccountContextValue {
  user: AccountUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { email: string; password: string; name?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Authenticated call that refreshes-and-retries once on a 401. */
  authedFetch: <T>(path: string, opts?: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown }) => Promise<T>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const authBase = (tenant: string) => `/storefront/${tenant}/account/auth`;

export function AccountProvider({ tenant, children }: { tenant: string; children: React.ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const sessionHint = `ecom_customer_session:${tenant}`;

  const applyTokens = useCallback((tokens: CustomerTokens) => {
    tokenRef.current = tokens.access_token;
    setUser({
      id: tokens.customer.id,
      email: tokens.customer.email,
      emailVerified: tokens.customer.email_verified,
    });
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const tokens = await clientApi<CustomerTokens>(`${authBase(tenant)}/refresh`, { method: 'POST' });
      applyTokens(tokens);
      localStorage.setItem(sessionHint, '1');
      return true;
    } catch {
      tokenRef.current = null;
      setUser(null);
      localStorage.removeItem(sessionHint);
      return false;
    }
  }, [tenant, applyTokens, sessionHint]);

  // Restore an existing session from the refresh cookie on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (localStorage.getItem(sessionHint)) await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, sessionHint]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await clientApi<CustomerTokens>(`${authBase(tenant)}/login`, {
        method: 'POST',
        body: { email, password },
      });
      applyTokens(tokens);
      localStorage.setItem(sessionHint, '1');
    },
    [tenant, applyTokens, sessionHint],
  );

  const signup = useCallback(
    async (input: { email: string; password: string; name?: string; phone?: string }) => {
      await clientApi(`${authBase(tenant)}/signup`, { method: 'POST', body: input });
    },
    [tenant],
  );

  const logout = useCallback(async () => {
    try {
      await clientApi(`${authBase(tenant)}/logout`, { method: 'POST' });
    } catch {
      /* best-effort; clear locally regardless */
    }
    tokenRef.current = null;
    setUser(null);
    localStorage.removeItem(sessionHint);
  }, [tenant, sessionHint]);

  const authedFetch = useCallback(
    async <T,>(
      path: string,
      opts: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {},
    ): Promise<T> => {
      const run = () => clientApi<T>(path, { ...opts, token: tokenRef.current });
      try {
        return await run();
      } catch (e) {
        if (isApiError(e) && e.status === 401 && (await refresh())) {
          return run();
        }
        throw e;
      }
    },
    [refresh],
  );

  const value = useMemo<AccountContextValue>(
    () => ({ user, loading, login, signup, logout, authedFetch }),
    [user, loading, login, signup, logout, authedFetch],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider');
  return ctx;
}
