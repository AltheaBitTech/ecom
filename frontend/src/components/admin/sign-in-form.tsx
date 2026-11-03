'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Client sign-in form. Posts to the same-origin BFF (`/api/admin/login`), which
 * sets the httpOnly session cookies — no token ever lives in browser JS. On
 * success we refresh so the server components pick up the new session.
 */
export function SignInForm({ initialSlug = '', notice }: { initialSlug?: string; notice?: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email, password }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { mfa_required?: boolean; tenant_selection_required?: boolean }; error?: { message?: string } }
        | null;

      if (!res.ok) {
        setError(body?.error?.message ?? 'Sign in failed. Check your details and try again.');
        return;
      }
      if (body?.data?.mfa_required) {
        setError('This account requires two-factor authentication, which is not supported here yet.');
        return;
      }
      if (body?.data?.tenant_selection_required) {
        setError('This account belongs to multiple stores. Please contact support.');
        return;
      }
      // Success — cookies set by the BFF; land on the dashboard.
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {notice && (
        <p className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800" role="status">
          <span aria-hidden>✓</span><span>{notice}</span>
        </p>
      )}
      <div className="auth-field">
        <label htmlFor="slug" className="auth-label"><span>01</span> Store address</label>
        <div>
          <input
            id="slug"
            className="auth-input"
            placeholder="your-store"
            autoCapitalize="none"
            autoCorrect="off"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
        </div>
        <p className="auth-helper">The final part of your customer URL, for example <strong>/your-store</strong>.</p>
      </div>
      <div className="auth-field">
        <label htmlFor="email" className="auth-label"><span>02</span> Email address</label>
        <input
          id="email"
          type="email"
          className="auth-input"
          placeholder="you@example.com"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="auth-field">
        <label htmlFor="password" className="auth-label"><span>03</span> Password</label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className="auth-input pr-16"
            autoComplete="current-password"
            placeholder="Your secure password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" className="auth-reveal" onClick={() => setShowPassword((shown) => !shown)} aria-label={`${showPassword ? 'Hide' : 'Show'} password`}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {error && (
        <p className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">
          <span aria-hidden>!</span><span>{error}</span>
        </p>
      )}

      <Button type="submit" size="lg" className="h-14! w-full justify-between! rounded-xl! bg-[#111827]! px-6! hover:bg-[#ff4b2b]!" disabled={pending}>
        <span>{pending ? 'Signing in…' : 'Enter dashboard'}</span><span aria-hidden>↗</span>
      </Button>
    </form>
  );
}
