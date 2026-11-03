'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Self-serve store creation. Posts to the same-origin BFF (`/api/onboard`),
 * which holds the internal key and provisions the store + owner. On success we
 * send the merchant to sign-in with their subdomain prefilled — the owner
 * password they just chose was set on the identity side, so they can sign in
 * immediately.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function OnboardForm({ defaultPlan = 'starter' }: { defaultPlan?: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState(defaultPlan);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Derive the subdomain from the store name until the merchant edits it.
  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: effectiveSlug,
          owner_name: ownerName,
          owner_email: email,
          owner_password: password,
          plan_key: plan,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { data?: { slug: string; name: string }; error?: { message?: string } }
        | null;

      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not create your store. Please try again.');
        return;
      }
      // Store created and owner password set — go sign in, subdomain prefilled.
      const created = body?.data?.slug ?? effectiveSlug;
      router.push(`/admin/sign-in?slug=${encodeURIComponent(created)}&created=1`);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="auth-field">
        <label htmlFor="name" className="auth-label"><span>01</span> Store name</label>
        <input
          id="name"
          className="auth-input"
          placeholder="North Studio"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="slug" className="auth-label"><span>02</span> Store address</label>
        <div className="auth-input-group">
          <input
            id="slug"
            className="auth-input border-0! bg-transparent!"
            placeholder="north-studio"
            autoCapitalize="none"
            autoCorrect="off"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            required
          />
        </div>
        <p className="auth-helper" aria-live="polite">
          Customer URL: <strong>{SITE_URL}/{effectiveSlug || 'your-store'}</strong>
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="auth-field">
          <label htmlFor="ownerName" className="auth-label"><span>03</span> Your name</label>
          <input
            id="ownerName"
            className="auth-input"
            placeholder="Dana Smith"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="email" className="auth-label"><span>04</span> Email</label>
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
      </div>

      <div className="auth-field">
        <label htmlFor="password" className="auth-label"><span>05</span> Password</label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className="auth-input pr-16"
            autoComplete="new-password"
            placeholder="At least 12 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            required
          />
          <button type="button" className="auth-reveal" onClick={() => setShowPassword((shown) => !shown)} aria-label={`${showPassword ? 'Hide' : 'Show'} password`}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/10"><span className="block h-full bg-[#ff4b2b] transition-all" style={{ width: `${Math.min(100, password.length / 12 * 100)}%` }} /></span>
          <span className="text-[10px] font-bold uppercase tracking-[.14em] text-black/35">12+ characters</span>
        </div>
      </div>

      <div className="auth-field">
        <label htmlFor="plan" className="auth-label"><span>06</span> Starting plan</label>
        <select id="plan" className="auth-input cursor-pointer" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="starter">Starter — free trial</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="h-14! w-full justify-between! rounded-xl! bg-[#111827]! px-6! hover:bg-[#ff4b2b]!" disabled={pending}>
        <span>{pending ? 'Creating your store…' : 'Create my store'}</span><span aria-hidden>↗</span>
      </Button>
      <p className="text-center text-[10px] font-bold uppercase tracking-[.14em] text-black/30">No card required · Cancel anytime</p>
    </form>
  );
}
