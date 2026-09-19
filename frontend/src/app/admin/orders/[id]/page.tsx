'use client';

import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Link from 'next/link';
import { OrderTimeline } from '@/components/admin/order-timeline';
import { InvoiceView } from '@/components/admin/invoice-view';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import type { Order, OrderStatus, ReturnStatus } from '@/lib/types';

function money(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency });
}

const statusVariant: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'outline',
  SHIPPED: 'outline',
  FULFILLED: 'default',
  CANCELLED: 'destructive',
};

const NEXT_ACTION: Partial<Record<OrderStatus, { action: 'confirm' | 'ship' | 'fulfill'; label: string }>> = {
  PENDING: { action: 'confirm', label: 'Confirm order' },
  CONFIRMED: { action: 'ship', label: 'Mark shipped' },
  SHIPPED: { action: 'fulfill', label: 'Mark fulfilled' },
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.ORDERS_MANAGE);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  function load() {
    api<Order>(`/orders/${id}`)
      .then(setOrder)
      .catch(() => toast.error('Failed to load order'));
  }
  useEffect(load, [id]);

  async function transition(action: 'confirm' | 'ship' | 'fulfill' | 'cancel') {
    setBusy(true);
    try {
      const body =
        action === 'ship' ? { trackingNumber: trackingNumber || undefined, courierName: courierName || undefined }
        : action === 'cancel' ? { reason: cancelReason.trim() || undefined }
        : undefined;
      await api(`/orders/${id}/${action}`, { method: 'POST', body });
      toast.success(`Order ${action === 'confirm' ? 'confirmed' : action === 'ship' ? 'marked shipped' : action === 'fulfill' ? 'fulfilled' : 'cancelled'}${action === 'cancel' ? ' — the customer has been notified' : ''}`);
      setShipping(false);
      setTrackingNumber('');
      setCourierName('');
      setCancelling(false);
      setCancelReason('');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${action} order`);
    } finally {
      setBusy(false);
    }
  }

  async function resolveReturn(returnId: string, status: ReturnStatus, refundCents?: number) {
    setBusy(true);
    try {
      await api(`/orders/returns/${returnId}`, { method: 'PATCH', body: { status, refundCents } });
      toast.success(`Return ${status.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update return');
    } finally {
      setBusy(false);
    }
  }

  async function generateInvoice() {
    setBusy(true);
    try {
      await api(`/orders/${id}/invoice`, { method: 'POST' });
      toast.success('Invoice generated');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to generate invoice');
    } finally {
      setBusy(false);
    }
  }

  // The cancellation reason lives on the CANCELLED status event, not the order row.
  const cancelledEvent = order?.events.find((e) => e.status === 'CANCELLED');

  return (
    <div className="grid gap-6">
      <Link href="/admin/orders" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to orders
      </Link>

      {!order && <Skeleton className="h-64 w-full" />}

      {order && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Order for {order.customer.name}</h1>
              <p className="text-muted-foreground">
                Placed {new Date(order.createdAt).toLocaleString()} · <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
              </p>
            </div>
            {canManage && order.status !== 'FULFILLED' && order.status !== 'CANCELLED' && (
              <div className="flex gap-2">
                {NEXT_ACTION[order.status] && order.status !== 'CONFIRMED' && (
                  <Button size="sm" disabled={busy} onClick={() => transition(NEXT_ACTION[order.status]!.action)}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {NEXT_ACTION[order.status]!.label}
                  </Button>
                )}
                {order.status === 'CONFIRMED' && !shipping && (
                  <Button size="sm" onClick={() => setShipping(true)}>Mark shipped</Button>
                )}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setCancelling(true)}>
                  Cancel order
                </Button>
              </div>
            )}
          </div>

          {shipping && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 p-4">
              <div className="grid gap-1.5">
                <Label>Tracking number (optional)</Label>
                <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-48" />
              </div>
              <div className="grid gap-1.5">
                <Label>Courier (optional)</Label>
                <Input value={courierName} onChange={(e) => setCourierName(e.target.value)} className="w-48" placeholder="e.g. Delhivery" />
              </div>
              <Button size="sm" disabled={busy} onClick={() => transition('ship')}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Confirm shipped
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShipping(false)}>Cancel</Button>
            </div>
          )}

          {(order.trackingNumber || order.courierName) && (
            <p className="text-sm text-muted-foreground">
              Tracking: {order.trackingNumber ?? '—'}{order.courierName && ` via ${order.courierName}`}
            </p>
          )}

          <div className="rounded-lg border p-6">
            <OrderTimeline status={order.status} events={order.events} cancelReason={cancelledEvent?.note} />
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3 font-medium">Items</div>
            <ul className="divide-y">
              {order.items.map((line) => (
                <li key={line.id} className="flex justify-between px-4 py-3 text-sm">
                  <span>
                    {line.quantity} × {line.product.name}
                    {line.variantLabel && ` (${line.variantLabel})`} ({line.product.sku})
                  </span>
                  <span>{money(line.lineTotalCents, order.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1.5 border-t px-4 py-4 text-sm sm:ml-auto sm:w-64">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{money(order.subtotalCents, order.currency)}</dd>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <dt>Discount</dt>
                  <dd>−{money(order.discountCents, order.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{money(order.taxCents, order.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{order.shippingCents ? money(order.shippingCents, order.currency) : 'Free'}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{money(order.totalCents, order.currency)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3 font-medium">Status history</div>
            <ul className="divide-y">
              {order.events.map((event) => (
                <li key={event.id} className="flex justify-between px-4 py-2.5 text-sm">
                  <span>{event.status}{event.note && ` — ${event.note}`}</span>
                  <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invoice</h2>
              {!order.invoice && canManage && (
                <Button size="sm" variant="outline" disabled={busy} onClick={generateInvoice}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Generate invoice
                </Button>
              )}
            </div>
            {order.invoice ? <InvoiceView invoice={order.invoice} order={order} /> : <p className="text-sm text-muted-foreground">No invoice yet.</p>}
          </div>

          <Dialog open={cancelling} onOpenChange={(open) => { if (!open) setCancelling(false); }}>
            <DialogContent className="sm:max-w-md">
              <DialogTitle>Cancel this order?</DialogTitle>
              <DialogDescription>
                {order.status === 'PENDING'
                  ? 'No stock was deducted for this order, so nothing is restocked.'
                  : 'Every line is restocked automatically.'}{' '}
                The customer is emailed the reason you give here, and it is recorded on the order timeline.
              </DialogDescription>
              <div className="grid gap-2">
                <Label htmlFor="cancel-reason">Reason (optional, shown to the customer)</Label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  maxLength={500}
                  placeholder="e.g. Out of stock at the warehouse — we're sorry for the trouble."
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCancelling(false)}>Keep order</Button>
                <Button variant="destructive" disabled={busy} onClick={() => transition('cancel')}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Cancel order
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {order.returns.length > 0 && (
            <div className="rounded-lg border">
              <div className="border-b px-4 py-3 font-medium">Returns</div>
              <ul className="divide-y">
                {order.returns.map((r) => (
                  <li key={r.id} className="grid gap-2 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.reason}</span>
                      <Badge variant={r.status === 'REJECTED' ? 'destructive' : r.status === 'REFUNDED' ? 'default' : 'outline'}>{r.status}</Badge>
                    </div>
                    <span className="text-muted-foreground">Requested {new Date(r.createdAt).toLocaleString()}</span>
                    {r.adminNote && <span className="text-muted-foreground">Note: {r.adminNote}</span>}
                    {canManage && (r.status === 'REQUESTED' || r.status === 'APPROVED') && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {r.status === 'REQUESTED' && (
                          <>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => resolveReturn(r.id, 'APPROVED')}>Approve</Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => resolveReturn(r.id, 'REJECTED')}>Reject</Button>
                          </>
                        )}
                        {r.status === 'APPROVED' && (
                          <Button size="sm" disabled={busy} onClick={() => resolveReturn(r.id, 'REFUNDED', order.totalCents)}>
                            Mark refunded (full amount)
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
