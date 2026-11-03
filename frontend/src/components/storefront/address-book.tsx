'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge, Spinner } from '@/components/ui/primitives';
import { isApiError } from '@/lib/client-api';
import type { Address, AddressInput } from '@/lib/types';

import { useAccount } from './account-provider';

const EMPTY: AddressInput = {
  full_name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'IN',
  phone: '',
  label: '',
};

/** A shopper's saved addresses. Ownership is enforced by the backend (the token's
 *  customer id + tenant), so this UI only orchestrates the CRUD calls. */
export function AddressBook({ tenant }: { tenant: string }) {
  const { authedFetch } = useAccount();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Address | null>(null);
  const [creating, setCreating] = useState(false);

  const base = `/storefront/${tenant}/account/addresses`;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAddresses(await authedFetch<Address[]>(base));
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load addresses.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, base]);

  useEffect(() => {
    // Fetch-on-mount: refresh is async, so any setState it does happens after
    // an await, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function remove(id: string) {
    await authedFetch(`${base}/${id}`, { method: 'DELETE' });
    void refresh();
  }

  async function makeDefault(id: string) {
    await authedFetch(`${base}/${id}/default`, { method: 'POST' });
    void refresh();
  }

  if (loading) return <Spinner label="Loading addresses…" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Saved addresses</h2>
        {!creating && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
            Add address
          </Button>
        )}
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {creating && (
        <AddressForm
          tenant={tenant}
          onDone={() => {
            setCreating(false);
            void refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && (
        <AddressForm
          tenant={tenant}
          existing={editing}
          onDone={() => {
            setEditing(null);
            void refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {!creating && !editing && addresses.length === 0 && (
        <p className="text-sm text-ink-muted">You have no saved addresses yet.</p>
      )}

      {!creating && !editing && addresses.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="store-account-card text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{a.full_name}</span>
                {a.is_default && <Badge tone="success">Default</Badge>}
              </div>
              <p className="mt-1 text-ink-muted">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''}
                <br />
                {a.city}
                {a.state ? `, ${a.state}` : ''} {a.postal_code}
                <br />
                {a.country}
                {a.phone ? ` · ${a.phone}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!a.is_default && (
                  <button
                    type="button"
                    onClick={() => makeDefault(a.id)}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Set default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="text-xs font-medium text-ink-soft hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddressForm({
  tenant,
  existing,
  onDone,
  onCancel,
}: {
  tenant: string;
  existing?: Address;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { authedFetch } = useAccount();
  const [form, setForm] = useState<AddressInput>(
    existing
      ? {
          label: existing.label ?? '',
          full_name: existing.full_name,
          phone: existing.phone ?? '',
          line1: existing.line1,
          line2: existing.line2 ?? '',
          city: existing.city,
          state: existing.state ?? '',
          postal_code: existing.postal_code,
          country: existing.country,
          is_default: existing.is_default,
        }
      : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof AddressInput, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: AddressInput = {
      ...form,
      country: form.country.toUpperCase().slice(0, 2),
      label: form.label?.trim() || undefined,
      line2: form.line2?.trim() || undefined,
      state: form.state?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
    };
    try {
      const base = `/storefront/${tenant}/account/addresses`;
      if (existing) await authedFetch(`${base}/${existing.id}`, { method: 'PUT', body: payload });
      else await authedFetch(base, { method: 'POST', body: payload });
      onDone();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not save the address.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="store-account-card mb-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Full name" span2 value={form.full_name} onChange={(v) => set('full_name', v)} required />
        <F label="Address line 1" span2 value={form.line1} onChange={(v) => set('line1', v)} required />
        <F label="Address line 2" span2 value={form.line2 ?? ''} onChange={(v) => set('line2', v)} />
        <F label="City" value={form.city} onChange={(v) => set('city', v)} required />
        <F label="State / region" value={form.state ?? ''} onChange={(v) => set('state', v)} />
        <F label="Postal code" value={form.postal_code} onChange={(v) => set('postal_code', v)} required />
        <F label="Country (2-letter)" value={form.country} onChange={(v) => set('country', v)} required />
        <F label="Phone" span2 value={form.phone ?? ''} onChange={(v) => set('phone', v)} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.is_default)}
          onChange={(e) => set('is_default', e.target.checked)}
        />
        Make this my default address
      </label>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : existing ? 'Save changes' : 'Add address'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function F({
  label,
  value,
  onChange,
  required,
  span2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : undefined}>
      <label className="label">{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
