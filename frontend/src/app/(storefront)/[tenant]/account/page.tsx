'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAccount } from '@/components/storefront/account-provider';
import { AddressBook } from '@/components/storefront/address-book';
import { AuthForm } from '@/components/storefront/auth-form';
import { OrderHistory } from '@/components/storefront/order-history';
import { StorePage, StorePanel } from '@/components/storefront/store-page';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/primitives';
import { isApiError } from '@/lib/client-api';
import type { Profile } from '@/lib/types';

type Tab = 'orders' | 'addresses' | 'profile';

const TABS: { key: Tab; label: string }[] = [
  { key: 'orders', label: 'Orders' },
  { key: 'addresses', label: 'Addresses' },
  { key: 'profile', label: 'Profile' },
];

export default function AccountPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user, loading, logout } = useAccount();
  const [tab, setTab] = useState<Tab>('orders');

  if (loading) return <div className="store-subpage"><Spinner label="Loading your account…" /></div>;
  if (!user) return <StorePage eyebrow="Customer account" title="Welcome back" className="store-account-page"><AuthForm /></StorePage>;

  return (
    <StorePage eyebrow="Customer account" title="My account" intro={user.email} className="store-account-page">
      <StorePanel>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">Manage your orders, delivery details, and profile.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => logout()}>
          Sign out
        </Button>
      </div>

      <nav className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'orders' && <OrderHistory tenant={tenant} />}
      {tab === 'addresses' && <AddressBook tenant={tenant} />}
      {tab === 'profile' && <ProfilePanel tenant={tenant} />}
      </StorePanel>
    </StorePage>
  );
}

function ProfilePanel({ tenant }: { tenant: string }) {
  const { authedFetch } = useAccount();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authedFetch<Profile>(`/storefront/${tenant}/account/profile`)
      .then((p) => {
        setProfile(p);
        setName(p.name ?? '');
      })
      .catch((e) => setError(isApiError(e) ? e.message : 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, [authedFetch, tenant]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await authedFetch<Profile>(`/storefront/${tenant}/account/profile`, {
        method: 'PATCH',
        body: { name: name.trim() },
      });
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading your profile…" />;
  if (!profile) return <p className="text-sm text-red-700">{error ?? 'Profile unavailable.'}</p>;

  return (
    <form onSubmit={save} className="max-w-md space-y-4">
      <div>
        <label className="label">Email</label>
        <input className="input bg-paper-sunken" value={profile.email} disabled />
        <p className="mt-1 text-xs text-ink-faint">
          {profile.email_verified ? 'Verified' : 'Not verified'}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Profile saved.</p>}

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
