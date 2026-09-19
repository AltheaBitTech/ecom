'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { api, apiDownload, ApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import type { Order, OrderStatus, Customer, Product } from '@/lib/types';

const statusVariant: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'outline',
  SHIPPED: 'outline',
  FULFILLED: 'default',
  CANCELLED: 'destructive',
};

function money(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency });
}

const STATUS_OPTIONS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'FULFILLED', 'CANCELLED'];
type SortBy = 'createdAt' | 'totalCents';

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}

function OrdersView() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string } | { bulk: true } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const canManage = hasPermission(PERMISSIONS.ORDERS_MANAGE);

  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const sortBy = (searchParams.get('sortBy') as SortBy) || 'createdAt';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
  const [searchInput, setSearchInput] = useState(search);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`?${params.toString()}`);
  }

  // Debounce the search box — no lib, plain setTimeout.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) setParams({ search: searchInput || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    api<Order[]>(`/orders?${params.toString()}`)
      .then((o) => { setOrders(o); setSelected((prev) => new Set([...prev].filter((id) => o.some((x) => x.id === id)))); })
      .catch(() => toast.error('Failed to load orders'));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [status, search, sortBy, sortDir]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    apiDownload(`/orders/export?${params.toString()}`, 'orders.csv').catch(() => toast.error('Export failed'));
  }

  function toggleSort(col: SortBy) {
    if (sortBy === col) setParams({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
    else setParams({ sortBy: col, sortDir: 'desc' });
  }

  function sortHeader(col: SortBy, children: React.ReactNode) {
    return (
      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
        <span className="inline-flex items-center gap-1">
          {children}
          {sortBy === col && (sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </span>
      </TableHead>
    );
  }

  async function transition(id: string, action: 'confirm' | 'ship' | 'fulfill' | 'cancel') {
    setBusyId(id);
    try {
      await api(`/orders/${id}/${action}`, { method: 'POST', body: action === 'cancel' ? { reason: cancelReason.trim() || undefined } : undefined });
      toast.success(`Order ${action === 'confirm' ? 'confirmed' : action === 'ship' ? 'marked shipped' : action === 'fulfill' ? 'fulfilled' : 'cancelled'}`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${action} order`);
    } finally {
      setBusyId(null);
    }
  }

  // Cancelling is the one irreversible action here, and the reason reaches the customer — so it
  // always goes through the dialog, whether it started as a row action or a bulk action.
  function askToCancel(target: { id: string } | { bulk: true }) {
    setCancelReason('');
    setCancelTarget(target);
  }

  async function confirmCancel() {
    const target = cancelTarget;
    setCancelTarget(null);
    if (!target) return;
    if ('bulk' in target) await bulkTransition('cancel');
    else await transition(target.id, 'cancel');
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ponytail: reuses the existing per-id transition endpoints in parallel — no dedicated bulk API.
  async function bulkTransition(action: 'confirm' | 'ship' | 'fulfill' | 'cancel') {
    const ids = [...selected];
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => api(`/orders/${id}/${action}`, { method: 'POST', body: action === 'cancel' ? { reason: cancelReason.trim() || undefined } : undefined })));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) toast.error(`${failed} of ${ids.length} orders failed to ${action}`);
      else toast.success(`${ids.length} order${ids.length === 1 ? '' : 's'} ${action === 'confirm' ? 'confirmed' : action === 'ship' ? 'marked shipped' : action === 'fulfill' ? 'fulfilled' : 'cancelled'}`);
      setSelected(new Set());
      load();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Confirm, fulfill, or cancel orders as they come in.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv()}>
            <Download className="size-4" />
            Export CSV
          </Button>
          {canManage && <CreateOrderDialog onCreated={load} />}
        </div>
      </div>

      {canManage && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkTransition('confirm')}>Confirm</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkTransition('ship')}>Ship</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkTransition('fulfill')}>Fulfill</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => askToCancel({ bulk: true })}>Cancel</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search customer name or email…"
          className="max-w-xs"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select value={status || 'all'} onValueChange={(v) => setParams({ status: v === 'all' ? null : (v as string) })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all orders"
                    checked={!!orders?.length && selected.size === orders.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(orders?.map((o) => o.id)) : new Set())}
                  />
                </TableHead>
              )}
              <TableHead>Customer</TableHead>
              {sortHeader('totalCents', 'Total')}
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              {sortHeader('createdAt', 'Placed')}
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={canManage ? 7 : 5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {orders?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 5} className="py-10 text-center text-muted-foreground">
                  No orders yet.
                </TableCell>
              </TableRow>
            )}
            {orders?.map((o) => (
              <Fragment key={o.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setOpenId(openId === o.id ? null : o.id)}
                >
                  {canManage && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select order for ${o.customer.name}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <Link href={`/admin/orders/${o.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {o.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell>{money(o.totalCents, o.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[o.status]}>{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.payment?.status ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                  {canManage && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {o.status === 'PENDING' && (
                          <Button variant="ghost" size="sm" disabled={busyId === o.id} onClick={() => transition(o.id, 'confirm')}>
                            Confirm
                          </Button>
                        )}
                        {o.status === 'CONFIRMED' && (
                          <Button variant="ghost" size="sm" disabled={busyId === o.id} onClick={() => transition(o.id, 'ship')}>
                            Ship
                          </Button>
                        )}
                        {o.status === 'SHIPPED' && (
                          <Button variant="ghost" size="sm" disabled={busyId === o.id} onClick={() => transition(o.id, 'fulfill')}>
                            Fulfill
                          </Button>
                        )}
                        {(o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'SHIPPED') && (
                          <Button variant="ghost" size="sm" disabled={busyId === o.id} onClick={() => askToCancel({ id: o.id })}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                {openId === o.id && (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 5} className="bg-muted/40">
                      <ul className="grid gap-1 py-2 text-sm text-muted-foreground">
                        {o.items.map((line) => (
                          <li key={line.id} className="flex justify-between">
                            <span>
                              {line.quantity} × {line.product.name}
                              {line.variantLabel && ` (${line.variantLabel})`} ({line.product.sku})
                            </span>
                            <span>{money(line.lineTotalCents, o.currency)}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {cancelTarget && 'bulk' in cancelTarget
                ? `Cancel ${selected.size} order${selected.size === 1 ? '' : 's'}?`
                : 'Cancel this order?'}
            </DialogTitle>
            <DialogDescription>
              Confirmed and shipped orders are restocked automatically. The reason you give is emailed to the
              customer and recorded on the order timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="bulk-cancel-reason">Reason (optional, shown to the customer)</Label>
            <Textarea
              id="bulk-cancel-reason"
              value={cancelReason}
              maxLength={500}
              placeholder="e.g. Out of stock at the warehouse — we're sorry for the trouble."
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>Keep {cancelTarget && 'bulk' in cancelTarget ? 'orders' : 'order'}</Button>
            <Button variant="destructive" disabled={bulkBusy} onClick={confirmCancel}>Cancel order{cancelTarget && 'bulk' in cancelTarget && selected.size !== 1 ? 's' : ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DraftLine {
  productId: string;
  variantId?: string;
  quantity: string;
}

function CreateOrderDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', quantity: '1' }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<Customer[]>('/customers').then(setCustomers).catch(() => toast.error('Failed to load customers'));
    api<Product[]>('/products').then(setProducts).catch(() => toast.error('Failed to load products'));
  }, [open]);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);
  const canSubmit = customerId && validLines.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/orders', {
        method: 'POST',
        body: {
          customerId,
          items: validLines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: Number(l.quantity) })),
        },
      });
      toast.success('Order created');
      setOpen(false);
      setCustomerId('');
      setLines([{ productId: '', quantity: '1' }]);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        New order
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create order</DialogTitle>
            <DialogDescription>Snapshots each product&apos;s current price.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={(v) => setCustomerId(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Items</Label>
              {lines.map((line, i) => {
                const lineProduct = products.find((p) => p.id === line.productId);
                return (
                <div key={i} className="flex gap-2">
                  <Select
                    value={line.productId}
                    onValueChange={(v) => updateLine(i, { productId: v as string, variantId: undefined })}
                  >
                    <SelectTrigger className="w-full flex-1">
                      <SelectValue placeholder="Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products
                        .filter((p) => !p.archivedAt)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {lineProduct && lineProduct.variants.length > 0 && (
                    <Select value={line.variantId} onValueChange={(v) => updateLine(i, { variantId: v as string })}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Option" />
                      </SelectTrigger>
                      <SelectContent>
                        {lineProduct.variants.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    className="w-20"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setLines((prev) => [...prev, { productId: '', quantity: '1' }])}
              >
                <Plus className="size-4" />
                Add line
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
