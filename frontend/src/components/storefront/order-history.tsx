'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge, Spinner } from '@/components/ui/primitives';
import { isApiError } from '@/lib/client-api';
import { formatMoney } from '@/lib/format';
import type { Order, OrderStatus, Page } from '@/lib/types';

import { useAccount } from './account-provider';

const STATUS_TONE: Record<OrderStatus, 'success' | 'warning' | 'neutral' | 'muted'> = {
  PENDING: 'warning',
  PAID: 'success',
  FULFILLED: 'success',
  CANCELLED: 'muted',
  REFUNDED: 'muted',
};

/** A shopper's own order history. The backend scopes it to the token's customer. */
export function OrderHistory({ tenant }: { tenant: string }) {
  const { authedFetch } = useAccount();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch<Page<Order>>(`/storefront/${tenant}/account/orders`)
      .then((p) => setOrders(p.data))
      .catch((e) => setError(isApiError(e) ? e.message : 'Could not load your orders.'))
      .finally(() => setLoading(false));
  }, [authedFetch, tenant]);

  if (loading) return <Spinner label="Loading your orders…" />;
  if (error) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (orders.length === 0) return <p className="text-sm text-ink-muted">You haven’t placed any orders yet.</p>;

  return (
    <ul className="store-account-card divide-y divide-line">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/${tenant}/orders/${o.id}`}
            className="flex items-center justify-between gap-3 p-4 hover:bg-paper-soft"
          >
            <div className="min-w-0">
              <p className="font-medium">{o.number}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {o.items.length} item{o.items.length === 1 ? '' : 's'} ·{' '}
                {new Date(o.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
              <span className="font-semibold">{formatMoney(o.total_cents, o.currency)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
