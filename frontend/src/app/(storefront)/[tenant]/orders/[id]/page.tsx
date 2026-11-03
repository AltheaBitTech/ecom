'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAccount } from '@/components/storefront/account-provider';
import { StorePage, StorePanel } from '@/components/storefront/store-page';
import { Button } from '@/components/ui/button';
import { Badge, Spinner } from '@/components/ui/primitives';
import { clientApi, isApiError } from '@/lib/client-api';
import { formatMoney } from '@/lib/format';
import { recallGuestOrderEmail } from '@/lib/guest-orders';
import type { Order, OrderStatus } from '@/lib/types';

const STATUS_TONE: Record<OrderStatus, 'success' | 'warning' | 'neutral' | 'muted'> = {
  PENDING: 'warning',
  PAID: 'success',
  FULFILLED: 'success',
  CANCELLED: 'muted',
  REFUNDED: 'muted',
};

export default function OrderPage() {
  const { tenant, id } = useParams<{ tenant: string; id: string }>();
  const { user, loading: authLoading, authedFetch } = useAccount();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailPrompt, setEmailPrompt] = useState('');

  const load = useCallback(
    async (guestEmail?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = user
          ? await authedFetch<Order>(`/storefront/${tenant}/orders/${id}`)
          : await clientApi<Order>(
              `/storefront/${tenant}/orders/${id}?email=${encodeURIComponent(guestEmail ?? '')}`,
            );
        setOrder(result);
      } catch (e) {
        setError(isApiError(e) ? e.message : 'Order not found.');
      } finally {
        setLoading(false);
      }
    },
    [user, tenant, id, authedFetch],
  );

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      // Fetch-on-mount/dependency-change: load is async, setState happens after an await.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
      return;
    }
    const remembered = recallGuestOrderEmail(tenant, id);
    if (remembered) load(remembered);
    else setLoading(false); // wait for the shopper to enter their email
  }, [authLoading, user, tenant, id, load]);

  if (authLoading || loading) return <div className="store-subpage"><Spinner label="Loading your order…" /></div>;

  // Guest with no remembered email: ask for it to authorise the lookup.
  if (!order && !user && !recallGuestOrderEmail(tenant, id)) {
    return (
      <StorePage eyebrow="Order tracking" title="Track your order" className="max-w-xl">
        <p className="mb-6 text-sm text-ink-muted">
          Enter the email you used at checkout to view this order.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(emailPrompt.trim());
          }}
          className="space-y-3"
        >
          <input
            type="email"
            required
            className="input"
            placeholder="you@example.com"
            value={emailPrompt}
            onChange={(e) => setEmailPrompt(e.target.value)}
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            View order
          </Button>
        </form>
      </StorePage>
    );
  }

  if (error || !order) {
    return (
      <StorePage eyebrow="Order tracking" title="Order not found" className="max-w-xl text-center">
        <p className="mb-6 text-sm text-ink-muted">{error ?? 'We couldn’t find this order.'}</p>
        <Button href={`/${tenant}`}>Back to store</Button>
      </StorePage>
    );
  }

  const addr = order.shipping_address;

  return (
    <StorePage eyebrow="Order tracking" title={order.status === 'PENDING' ? 'Order placed' : 'Thank you for your order'} intro={`Order ${order.number}`} className="store-order-page">
      <StorePanel className="store-order-status text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
          {order.status === 'PENDING' ? '🕓' : '✓'}
        </div>
        <div className="mt-3">
          <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
        </div>
        {order.status === 'PENDING' && (
          <p className="mt-3 text-sm text-amber-700">This order is awaiting payment.</p>
        )}
      </StorePanel>

      <StorePanel className="mt-6">
        <h2 className="text-base font-semibold">Items</h2>
        <ul className="mt-3 divide-y divide-line">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-2 py-3 text-sm">
              <span className="min-w-0 truncate text-ink-soft">
                {i.name} × {i.quantity}
              </span>
              <span className="shrink-0 font-medium">
                {formatMoney(i.price_cents * i.quantity, order.currency)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="font-medium">{formatMoney(order.subtotal_cents, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Shipping</dt>
            <dd className="font-medium">
              {order.shipping_cents === 0 ? 'Free' : formatMoney(order.shipping_cents, order.currency)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(order.total_cents, order.currency)}</dd>
          </div>
        </dl>
      </StorePanel>

      {addr && (
        <StorePanel className="mt-6">
          <h2 className="text-base font-semibold">Shipping to</h2>
          <address className="mt-2 text-sm not-italic text-ink-soft">
            {addr.name}
            <br />
            {addr.line1}
            {addr.line2 ? (
              <>
                <br />
                {addr.line2}
              </>
            ) : null}
            <br />
            {addr.city}
            {addr.state ? `, ${addr.state}` : ''} {addr.postal_code}
            <br />
            {addr.country}
          </address>
        </StorePanel>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <Button href={`/${tenant}`} variant="secondary">
          Continue shopping
        </Button>
        {user && (
          <Button href={`/${tenant}/account`} variant="ghost">
            View all orders
          </Button>
        )}
      </div>
    </StorePage>
  );
}
