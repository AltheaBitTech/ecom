'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { updateOrderStatus } from '@/app/(admin)/admin/(dashboard)/orders/actions';
import { Badge } from '@/components/admin-ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/admin-ui/dropdown-menu';
import { formatDate, formatMoney } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

const STATUS_VARIANT: Record<OrderStatus, 'default' | 'secondary' | 'outline'> = {
  PENDING: 'secondary',
  PAID: 'outline',
  FULFILLED: 'default',
  CANCELLED: 'outline',
  REFUNDED: 'outline',
};

// Legal next-states — mirrors the backend TRANSITIONS state machine so the UI
// only offers moves the API will accept. ponytail: kept in sync by hand; if the
// backend machine grows, update here too.
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['FULFILLED', 'REFUNDED', 'CANCELLED'],
  FULFILLED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const FILTERS: Array<{ id: 'all' | OrderStatus; text: string }> = [
  { id: 'all', text: 'All orders' },
  { id: 'PENDING', text: 'Pending' },
  { id: 'PAID', text: 'Paid' },
  { id: 'FULFILLED', text: 'Fulfilled' },
  { id: 'CANCELLED', text: 'Cancelled' },
  { id: 'REFUNDED', text: 'Refunded' },
];

/** Admin order list: search + status filter, per-row status transitions. */
export function OrdersManager({ orders, canWrite }: { orders: Order[]; canWrite: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== 'all' && o.status !== status) return false;
      if (!q) return true;
      return (
        o.number.toLowerCase().includes(q) ||
        (o.guest_email?.toLowerCase().includes(q) ?? false) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [orders, query, status]);

  async function changeStatus(id: string, next: OrderStatus) {
    if (!window.confirm(`Move this order to ${next.toLowerCase()}?`)) return;
    setBusy(true);
    const result = await updateOrderStatus(id, next);
    setBusy(false);
    if (!result.ok) return toast.error(result.error?.message ?? 'Could not update the order.');
    toast.success(`Order marked ${next.toLowerCase()}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input h-10 w-full max-w-xs"
          placeholder="Search order #, email, product…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input h-10 w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | OrderStatus)}
          aria-label="Filter by status"
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.text}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Items</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Placed</th>
              <th className="px-5 py-3 font-medium">Status</th>
              {canWrite && <th className="w-14 px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((order) => {
              const moves = NEXT[order.status];
              return (
                <tr key={order.id} className="hover:bg-paper-soft">
                  <td className="px-5 py-3 font-medium text-ink">#{order.number}</td>
                  <td className="px-5 py-3">
                    {(() => {
                      const label = order.guest_email ?? (order.customer_id ? 'Registered customer' : '—');
                      return (
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper-sunken text-xs font-semibold text-ink-soft">
                            {label.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-ink-soft">{label}</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">
                    {order.items[0]?.name ?? '—'}
                    {order.items.length > 1 && <span className="text-ink-faint"> +{order.items.length - 1}</span>}
                  </td>
                  <td className="px-5 py-3">{formatMoney(order.total_cents, order.currency)}</td>
                  <td className="px-5 py-3 text-ink-soft">{formatDate(order.created_at)}</td>
                  <td className="px-5 py-3"><Badge variant={STATUS_VARIANT[order.status]}>{order.status.toLowerCase()}</Badge></td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      {moves.length > 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Row actions" />}>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {moves.map((next) => (
                              <DropdownMenuItem key={next} disabled={busy} className="capitalize" onClick={() => changeStatus(order.id, next)}>
                                Mark {next.toLowerCase()}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-ink-faint">No orders match these filters.</td></tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-line px-5 py-3 text-xs text-ink-faint">
          Showing {filtered.length} of {orders.length} {orders.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>
    </div>
  );
}
