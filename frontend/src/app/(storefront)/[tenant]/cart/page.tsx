'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCart } from '@/components/storefront/cart-provider';
import { StorePage, StorePanel } from '@/components/storefront/store-page';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/primitives';
import { clientApi, isApiError } from '@/lib/client-api';
import { formatMoney } from '@/lib/format';
import type { CartQuote } from '@/lib/types';

/**
 * The cart. Lines live in the browser, but every total shown here comes from the
 * backend `cart/preview` endpoint — the client never sums prices itself, so what
 * the shopper sees always matches what checkout will charge.
 */
export default function CartPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { items, setQuantity, remove, ready } = useCart();

  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [pricing, setPricing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-price whenever the basket changes.
  useEffect(() => {
    if (!ready) return;
    if (items.length === 0) {
      // Reset when the basket empties — a real sync with the `items`
      // dependency, not a one-time mount concern a lazy initializer could cover.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setPricing(true);
    setError(null);
    clientApi<CartQuote>(`/storefront/${tenant}/cart/preview`, {
      method: 'POST',
      body: { items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) },
    })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((e) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Could not price your cart.');
      })
      .finally(() => {
        if (!cancelled) setPricing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [items, ready, tenant]);

  if (!ready) return <Spinner label="Loading your cart…" />;

  if (items.length === 0) {
    return (
      <StorePage eyebrow="Your selection" title="Your cart" className="max-w-3xl">
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          description="Browse the store and add something you like."
          action={<Button href={`/${tenant}`}>Continue shopping</Button>}
        />
      </StorePage>
    );
  }

  return (
    <StorePage eyebrow="Your selection" title="Your cart" intro={`${items.length} item${items.length === 1 ? '' : 's'} reserved for checkout`} className="store-commerce-page">
      <div className="store-commerce-grid">
        <div>
        <ul className="store-cart-lines">
          {items.map((item) => (
            <li key={item.product_id} className="store-cart-line">
              <div className="store-cart-image">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-ink-faint">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${tenant}/products/${item.product_id}`}
                  className="line-clamp-1 text-sm font-medium hover:underline"
                >
                  {item.name}
                </Link>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {formatMoney(item.price_cents, item.currency)}
                </p>
              </div>
              <QuantityStepper
                value={item.quantity}
                onChange={(q) => setQuantity(item.product_id, q)}
              />
              <div className="w-20 shrink-0 text-right text-sm font-semibold">
                {formatMoney(item.price_cents * item.quantity, item.currency)}
              </div>
              <button
                type="button"
                onClick={() => remove(item.product_id)}
                aria-label={`Remove ${item.name}`}
                className="shrink-0 rounded-lg px-2 py-1 text-ink-faint hover:bg-paper-sunken hover:text-ink"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <StorePanel as="aside" className="store-summary">
        <h2 className="text-base font-semibold">Summary</h2>
        {error ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
        ) : (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="font-medium">
                {quote ? formatMoney(quote.subtotal_cents, quote.currency) : '—'}
              </dd>
            </div>
            <div className="flex justify-between text-ink-muted">
              <dt>Shipping</dt>
              <dd>Calculated at checkout</dd>
            </div>
          </dl>
        )}
        <Button
          href={`/${tenant}/checkout`}
          size="lg"
          className="mt-5 w-full"
        >
          Checkout
        </Button>
        <p className="mt-3 text-center text-xs text-ink-faint">
          {pricing ? 'Updating prices…' : 'Taxes & shipping calculated at checkout'}
        </p>
      </StorePanel>
      </div>
    </StorePage>
  );
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (q: number) => void }) {
  return (
    <div className="flex shrink-0 items-center rounded-lg border border-line">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        aria-label="Decrease quantity"
        className="h-8 w-8 text-ink-muted hover:text-ink"
      >
        −
      </button>
      <span className="w-8 text-center text-sm tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        className="h-8 w-8 text-ink-muted hover:text-ink"
      >
        +
      </button>
    </div>
  );
}
