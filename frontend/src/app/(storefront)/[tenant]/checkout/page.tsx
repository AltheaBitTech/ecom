'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAccount } from '@/components/storefront/account-provider';
import { useCart } from '@/components/storefront/cart-provider';
import { StorePage, StorePanel } from '@/components/storefront/store-page';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/primitives';
import { clientApi, isApiError } from '@/lib/client-api';
import { formatMoney } from '@/lib/format';
import { rememberGuestOrder } from '@/lib/guest-orders';
import { openRazorpayCheckout } from '@/lib/razorpay';
import type { Address, CartQuote, Order, PaymentIntent, ShippingAddress, ShippingRate } from '@/lib/types';

type AddressForm = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
};

const EMPTY_ADDRESS: AddressForm = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'IN',
  phone: '',
};

export default function CheckoutPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const { items, clear, ready } = useCart();
  const { user, authedFetch } = useAccount();

  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState<Address[]>([]);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [rates, setRates] = useState<ShippingRate[] | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartItems = items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));

  // Subtotal preview (authoritative) for the summary.
  useEffect(() => {
    if (!ready || items.length === 0) return;
    clientApi<CartQuote>(`/storefront/${tenant}/cart/preview`, { method: 'POST', body: { items: cartItems } })
      .then(setQuote)
      .catch(() => setQuote(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, items]);

  // Signed-in shoppers: pull saved addresses and prefill the default.
  useEffect(() => {
    if (!user) return;
    authedFetch<Address[]>(`/storefront/${tenant}/account/addresses`)
      .then((list) => {
        setSaved(list);
        const pick = list.find((a) => a.is_default) ?? list[0];
        if (pick) applySaved(pick);
      })
      .catch(() => setSaved([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tenant]);

  function applySaved(a: Address) {
    setAddress({
      name: a.full_name,
      line1: a.line1,
      line2: a.line2 ?? '',
      city: a.city,
      state: a.state ?? '',
      postal_code: a.postal_code,
      country: a.country,
      phone: a.phone ?? '',
    });
  }

  const canQuote = address.postal_code.trim().length >= 2 && address.country.trim().length === 2;

  // Quote shipping once we have a destination.
  const fetchRates = useCallback(async () => {
    if (!canQuote || items.length === 0) return;
    setLoadingRates(true);
    setError(null);
    try {
      const result = await clientApi<ShippingRate[]>(`/storefront/${tenant}/shipping/rates`, {
        method: 'POST',
        body: {
          items: cartItems,
          destination: { postal_code: address.postal_code.trim(), country: address.country.trim().toUpperCase() },
        },
      });
      setRates(result);
      const cheapest = [...result].sort((a, b) => a.amountCents - b.amountCents)[0];
      setService((prev) => prev ?? cheapest?.service ?? null);
    } catch (e) {
      setRates([]);
      setError(isApiError(e) ? e.message : 'Could not fetch shipping options.');
    } finally {
      setLoadingRates(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canQuote, tenant, address.postal_code, address.country, items]);

  const selectedRate = rates?.find((r) => r.service === service) ?? null;
  const shippingCents = selectedRate?.amountCents ?? 0;

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user && !email.trim()) {
      setError('Please enter a contact email.');
      return;
    }
    setPlacing(true);

    const shipping_address: ShippingAddress = {
      name: address.name.trim(),
      line1: address.line1.trim(),
      line2: address.line2.trim() || undefined,
      city: address.city.trim(),
      state: address.state.trim() || undefined,
      postal_code: address.postal_code.trim(),
      country: address.country.trim().toUpperCase(),
      phone: address.phone.trim() || undefined,
    };

    const guestEmail = email.trim();
    const emailQuery = user ? '' : `?email=${encodeURIComponent(guestEmail)}`;
    // Signed-in shoppers carry a bearer token; guests pass their email so the
    // backend can attribute and later authorise the order.
    const send = <T,>(path: string, body?: unknown) =>
      user
        ? authedFetch<T>(path, { method: 'POST', body })
        : clientApi<T>(`${path}${emailQuery}`, { method: 'POST', body });

    try {
      const order = await send<Order>(`/storefront/${tenant}/checkout`, {
        items: cartItems,
        ...(user ? {} : { email: guestEmail }),
        shipping_address,
        shipping_service: service ?? undefined,
      });

      // Create a payment intent for the freshly-created PENDING order.
      const intent = await send<PaymentIntent>(`/storefront/${tenant}/orders/${order.id}/pay`);

      if (intent.requires_gateway) {
        const callback = await openRazorpayCheckout(intent, {
          name: 'Checkout',
          prefill: { email: user?.email ?? guestEmail, contact: address.phone },
        });
        await send<Order>(`/storefront/${tenant}/orders/${order.id}/pay/verify`, {
          provider_order_id: callback.provider_order_id,
          provider_payment_id: callback.provider_payment_id,
          signature: callback.signature,
        });
      }

      if (!user) rememberGuestOrder(tenant, order.id, guestEmail);
      clear();
      router.push(`/${tenant}/orders/${order.id}`);
    } catch (err) {
      setError(isApiError(err) ? err.message : (err as Error).message || 'Checkout failed. Please try again.');
      setPlacing(false);
    }
  }

  if (!ready) return <Spinner label="Loading checkout…" />;

  if (items.length === 0) {
    return (
      <StorePage eyebrow="Secure checkout" title="Checkout" className="max-w-3xl">
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          description="Add something before checking out."
          action={<Button href={`/${tenant}`}>Continue shopping</Button>}
        />
      </StorePage>
    );
  }

  return (
    <StorePage eyebrow="Secure checkout" title="Complete your order" intro="Shipping and payment are protected end to end." className="store-commerce-page store-checkout-page">
      <form onSubmit={placeOrder} className="store-commerce-grid">
      <div className="store-checkout-sections">
        <div className="store-checkout-intro">
          {!user && (
            <p className="mt-1 text-sm text-ink-muted">
              Have an account?{' '}
              <a href={`/${tenant}/account`} className="font-medium text-brand underline">
                Sign in
              </a>{' '}
              for faster checkout.
            </p>
          )}
        </div>

        {/* Contact */}
        {!user && (
          <StorePanel as="section" className="store-checkout-section">
            <h2 className="mb-3 text-base font-semibold">Contact</h2>
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
              placeholder="you@example.com"
            />
          </StorePanel>
        )}

        {/* Saved addresses */}
        {user && saved.length > 0 && (
          <StorePanel as="section" className="store-checkout-section">
            <h2 className="mb-3 text-base font-semibold">Saved addresses</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {saved.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => applySaved(a)}
                  className="rounded-xl border border-line p-3 text-left text-sm hover:border-brand"
                >
                  <span className="font-medium">{a.full_name}</span>
                  {a.is_default && <span className="ml-2 text-xs text-ink-faint">Default</span>}
                  <span className="mt-0.5 block text-ink-muted">
                    {a.line1}, {a.city} {a.postal_code}
                  </span>
                </button>
              ))}
            </div>
          </StorePanel>
        )}

        {/* Shipping address */}
        <StorePanel as="section" className="store-checkout-section">
          <h2 className="mb-3 text-base font-semibold">Shipping address</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" span2 value={address.name} onChange={(v) => setAddress({ ...address, name: v })} required />
            <Field label="Address line 1" span2 value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} required />
            <Field label="Address line 2" span2 value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} />
            <Field label="City" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} required />
            <Field label="State / region" value={address.state} onChange={(v) => setAddress({ ...address, state: v })} />
            <Field
              label="Postal code"
              value={address.postal_code}
              onChange={(v) => setAddress({ ...address, postal_code: v })}
              onBlur={fetchRates}
              required
            />
            <Field
              label="Country (2-letter)"
              value={address.country}
              onChange={(v) => setAddress({ ...address, country: v.toUpperCase().slice(0, 2) })}
              onBlur={fetchRates}
              required
            />
            <Field label="Phone" span2 value={address.phone} onChange={(v) => setAddress({ ...address, phone: v })} />
          </div>
        </StorePanel>

        {/* Shipping options */}
        <StorePanel as="section" className="store-checkout-section">
          <h2 className="mb-3 text-base font-semibold">Shipping method</h2>
          {loadingRates ? (
            <Spinner label="Fetching shipping options…" />
          ) : !rates ? (
            <p className="text-sm text-ink-muted">Enter your postal code to see shipping options.</p>
          ) : rates.length === 0 ? (
            <p className="text-sm text-ink-muted">No shipping options for this destination.</p>
          ) : (
            <div className="space-y-2">
              {rates.map((r) => (
                <label
                  key={r.service}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${
                    service === r.service ? 'border-brand ring-2 ring-brand/20' : 'border-line'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping"
                      checked={service === r.service}
                      onChange={() => setService(r.service)}
                    />
                    <span>
                      <span className="font-medium">{r.label}</span>
                      {r.carrier !== 'manual' && r.carrier !== 'none' && (
                        <span className="ml-2 text-ink-faint">{r.carrier}</span>
                      )}
                    </span>
                  </span>
                  <span className="font-semibold">
                    {r.amountCents === 0 ? 'Free' : formatMoney(r.amountCents, r.currency)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </StorePanel>
      </div>

      {/* Summary */}
      <StorePanel as="aside" className="store-summary">
        <h2 className="text-base font-semibold">Order summary</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.product_id} className="flex justify-between gap-2">
              <span className="min-w-0 truncate text-ink-muted">
                {i.name} × {i.quantity}
              </span>
              <span className="shrink-0 font-medium">{formatMoney(i.price_cents * i.quantity, i.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="font-medium">{quote ? formatMoney(quote.subtotal_cents, quote.currency) : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Shipping</dt>
            <dd className="font-medium">
              {selectedRate ? (shippingCents === 0 ? 'Free' : formatMoney(shippingCents, selectedRate.currency)) : '—'}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>
              {quote ? formatMoney(quote.subtotal_cents + shippingCents, quote.currency) : '—'}
            </dd>
          </div>
        </dl>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" size="lg" className="mt-5 w-full" disabled={placing}>
          {placing ? 'Placing order…' : 'Place order'}
        </Button>
        <p className="mt-3 text-center text-xs text-ink-faint">
          You’ll be asked to pay securely to complete the order.
        </p>
      </StorePanel>
      </form>
    </StorePage>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  required,
  span2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  required?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : undefined}>
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
      />
    </div>
  );
}
