import { OrdersManager } from '@/components/admin/orders-manager';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { formatMoney } from '@/lib/format';
import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { Order, Page } from '@/lib/types';

const STAT_TILES: Array<{ icon: string; label: string; match: (o: Order) => boolean }> = [
  { icon: '🕓', label: 'Pending', match: (o) => o.status === 'PENDING' },
  { icon: '📦', label: 'Fulfilled', match: (o) => o.status === 'FULFILLED' },
  { icon: '↩︎', label: 'Refunded or cancelled', match: (o) => o.status === 'REFUNDED' || o.status === 'CANCELLED' },
];

/** Orders list. Gated on orders:read; status transitions only show with
 *  orders:write. The backend enforces both the permission and the legal
 *  status-transition state machine. */
export default async function AdminOrders() {
  const session = await getStaffSession();

  if (!hasPermission(session!, 'orders:read')) {
    return (
      <div>
        <PageHeader title="Orders" />
        <EmptyState
          icon="🔒"
          title="You don't have access to orders"
          description="Ask an owner or manager to grant you the orders:read permission."
        />
      </div>
    );
  }

  const canWrite = hasPermission(session!, 'orders:write');

  let page: Page<Order> = { data: [], next_cursor: null, has_more: false };
  try {
    page = await ecomApi.adminOrders(session!.tenantId, '?limit=100');
  } catch {
    /* fall through to empty state */
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle="Fulfil, track and refund customer orders." />
      {page.data.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No orders yet"
          description="Orders placed in your storefront will appear here, ready to fulfil, track and refund."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {STAT_TILES.map((tile) => {
              const matching = page.data.filter(tile.match);
              const total = matching.reduce((sum, o) => sum + o.total_cents, 0);
              return (
                <Card key={tile.label} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper-sunken text-lg">{tile.icon}</span>
                  <div>
                    <p className="text-xl font-semibold leading-none">{matching.length}</p>
                    <p className="mt-1 text-xs text-ink-faint">{tile.label} · {formatMoney(total, matching[0]?.currency ?? 'USD')}</p>
                  </div>
                </Card>
              );
            })}
          </div>
          <OrdersManager orders={page.data} canWrite={canWrite} />
        </>
      )}
    </div>
  );
}
