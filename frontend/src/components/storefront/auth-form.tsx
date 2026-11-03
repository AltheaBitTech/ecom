'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/client-api';

import { useAccount } from './account-provider';

/**
 * Combined sign-in / create-account form for the storefront. Credentials go
 * straight to the ecom backend (which owns customer identity natively) — the
 * storefront never sees a password hash or mints a token.
 */
export function AuthForm() {
  const { login, signup } = useAccount();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await signup({ email: email.trim(), password, name: name.trim() || undefined });
        // Signup may require email verification before login is allowed.
        try {
          await login(email.trim(), password);
        } catch {
          setMode('login');
          setNotice('Account created. Please verify your email, then sign in.');
        }
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="store-auth-card mx-auto max-w-md">
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {mode === 'login' ? 'Access your orders and saved addresses.' : 'Save your details for faster checkout.'}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={mode === 'signup' ? 12 : undefined}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'signup' && (
            <p className="mt-1 text-xs text-ink-faint">At least 12 characters.</p>
          )}
        </div>

        {notice && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-muted">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
            setNotice(null);
          }}
          className="font-medium text-brand underline"
        >
          {mode === 'login' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
