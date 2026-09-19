'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, setAccessToken, tryRefresh } from './api';
import type { AuthSession, AuthUser, Tenant } from './types';

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  /** undefined = still bootstrapping (checking for an existing session). */
  status: 'loading' | 'authenticated' | 'anonymous';
  hasPermission: (permission: string) => boolean;
  login: (input: { tenantSlug: string; email: string; password: string }) => Promise<void>;
  register: (input: {
    businessName: string;
    ownerEmail: string;
    password: string;
    gstin?: string;
    legalName: string;
    pan?: string;
    referralCode?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetch the tenant/user (e.g. after saving onboarding details). */
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const router = useRouter();

  const loadMe = useCallback(async () => {
    const me = await api<{ tenant: Tenant; user: AuthUser }>('/auth/me');
    setUser(me.user);
    setTenant(me.tenant);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    // Access token lives only in memory, so a fresh page load has none yet —
    // ride the httpOnly refresh cookie to silently restore the session.
    (async () => {
      const ok = await tryRefresh();
      if (!ok) {
        setStatus('anonymous');
        return;
      }
      try {
        await loadMe();
      } catch {
        setStatus('anonymous');
      }
    })();
  }, [loadMe]);

  const applySession = useCallback(
    async (session: AuthSession) => {
      // login/register responses carry only { id, email } — no permissions (see AuthResult
      // on the backend). Fetch /auth/me for the real, live permission set before flipping
      // status to authenticated, so nothing renders against a half-populated user.
      setAccessToken(session.accessToken);
      await loadMe();
    },
    [loadMe],
  );

  const login = useCallback<AuthState['login']>(
    async (input) => {
      const session = await api<AuthSession>('/auth/login', { method: 'POST', body: input });
      await applySession(session);
    },
    [applySession],
  );

  const register = useCallback<AuthState['register']>(
    async (input) => {
      const session = await api<AuthSession>('/auth/register', { method: 'POST', body: input });
      await applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setUser(null);
    setTenant(null);
    setStatus('anonymous');
    router.push('/login');
  }, [router]);

  const hasPermission = useCallback((permission: string) => user?.permissions?.includes(permission) ?? false, [user]);

  return (
    <AuthContext.Provider value={{ user, tenant, status, hasPermission, login, register, logout, reload: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
