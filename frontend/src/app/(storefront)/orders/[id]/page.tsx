'use client';

import { use, useEffect, useState } from 'react';
import { StoreLink as Link } from '@/components/storefront/store-link';
import { OrderTimeline } from '@/components/admin/order-timeline';
import { InvoiceView } from '@/components/admin/invoice-view';
import { api, ApiError } from '@/lib/api';
import { money } from '@/lib/storefront';
import type { Order } from '@/lib/types';

// ponytail: order id + the email it was placed under is enough to prove ownership (same trust
// model as the storefront review-eligibility check) — no shopper account system to check against.
function snapshotEmail() {
  try {
    const raw = sessionStorage.getItem('storefront_order');
    const saved = raw ? (JSON.parse(raw) as { id?: string; email?: string }) : null;
    return saved?.email ?? '';
  } catch {
    return '';
  }
}

export default function StorefrontOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    // sessionStorage is client-only, so the saved email can only be read after mount.
    const saved = snapshotEmail();
    void Promise.resolve().then(() => {
      if (saved) {
        setEmail(saved);
        lookup(saved);
      } else {
        setOrder(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function lookup(candidateEmail: string) {
    setError('');
    setOrder(undefined);
    api<Order>(`/orders/public/${id}?email=${encodeURIComponent(candidateEmail)}`)
      .then(setOrder)
      .catch((err) => {
        setOrder(null);
        setError(err instanceof ApiError ? err.message : 'Could not find that order');
      });
  }

  return (
    <div className="store-container store-section">
      <p className="store-eyebrow">Order status</p>
      <h1 className="store-page-title">Track your order</h1>

      {order === null && (
        <form
          className="mt-8 max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) lookup(email.trim());
          }}
        >
          <label className="grid gap-2 text-sm">
            Email used at checkout
            <input className="store-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <button className="store-button mt-4" type="submit">Find my order</button>
        </form>
      )}

      {order === undefined && <p className="mt-8 text-muted-foreground">Looking up your order…</p>}

      {order && (
        <div className="mt-8 grid gap-8">
          <div className="rounded-2xl border p-6">
            <OrderTimeline status={order.status} events={order.events} cancelReason={order.events.find((e) => e.status === 'CANCELLED')?.note} />
            {(order.trackingNumber || order.courierName) && (
              <p className="mt-4 text-sm text-muted-foreground">
                Tracking: {order.trackingNumber ?? '—'}{order.courierName && ` via ${order.courierName}`}
              </p>
            )}
            {order.payment && order.status !== 'CANCELLED' && (
              <p className="mt-4 text-sm text-muted-foreground">
                Payment: {order.payment.status === 'PAID' ? 'Received in full' : order.payment.status === 'FAILED' ? 'Payment did not go through' : order.payment.status === 'REFUNDED' ? 'Refunded' : 'Awaiting confirmation'}
              </p>
            )}
          </div>

          <div className="rounded-2xl border">
            <div className="border-b px-5 py-3 font-medium">Items</div>
            <ul className="divide-y">
              {order.items.map((line) => (
                <li key={line.id} className="flex justify-between px-5 py-3 text-sm">
                  <span>
                    {line.quantity} × {line.product.name}
                    {line.variantLabel && ` (${line.variantLabel})`}
                  </span>
                  <span>{money(line.lineTotalCents, order.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1.5 border-t px-5 py-4 text-sm sm:ml-auto sm:w-64">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(order.subtotalCents, order.currency)}</dd></div>
              {order.discountCents > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><dt>Discount</dt><dd>−{money(order.discountCents, order.currency)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{money(order.taxCents, order.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{order.shippingCents ? money(order.shippingCents, order.currency) : 'Free'}</dd></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(order.totalCents, order.currency)}</dd></div>
            </dl>
          </div>

          {order.invoice && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Invoice</h2>
              <InvoiceView invoice={order.invoice} order={order} customerEmail={email} />
            </div>
          )}

          {(order.status === 'SHIPPED' || order.status === 'FULFILLED') && (
            <ReturnRequestSection orderId={order.id} email={email} returns={order.returns} onRequested={() => lookup(email)} />
          )}

          <Link className="store-text-link" href="/store#contact">Contact the store</Link>
        </div>
      )}
    </div>
  );
}

function ReturnRequestSection({ orderId, email, returns, onRequested }: { orderId: string; email: string; returns: Order['returns']; onRequested: () => void }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api(`/orders/public/${orderId}/returns`, { method: 'POST', body: { email, reason: reason.trim() } });
      setReason('');
      onRequested();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border p-6">
      <h2 className="text-lg font-semibold">Returns</h2>
      {returns.length > 0 && (
        <ul className="mt-3 grid gap-2 text-sm">
          {returns.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span>{r.reason}</span>
              <span className="text-muted-foreground">{r.status}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-4 grid gap-2 max-w-sm" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm">
          Reason for return
          <textarea className="store-input min-h-20" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <button className="store-button w-fit" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Request return'}
        </button>
      </form>
    </div>
  );
}
