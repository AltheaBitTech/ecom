'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IndianRupee, ShoppingCart, Receipt, Users, Star, PackageX, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Analytics, OrderStatus } from '@/lib/types';

function money(cents: number, currency = 'INR') {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
}

const statusVariant: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'outline',
  SHIPPED: 'outline',
  FULFILLED: 'default',
  CANCELLED: 'destructive',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api<Analytics>('/storefront/admin/analytics').then(setData).catch(() => toast.error('Failed to load analytics'));
  }, []);

  const stats = data && [
    { key: 'revenue', label: 'Revenue (paid, all-time)', icon: IndianRupee, value: money(data.revenueCents), color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { key: 'orders', label: 'Paid orders', icon: ShoppingCart, value: String(data.orderCount), color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { key: 'aov', label: 'Avg order value', icon: Receipt, value: money(data.avgOrderValueCents), color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { key: 'customers', label: 'Customers', icon: Users, value: `${data.customerCount} (+${data.newCustomers} in 30d)`, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ];

  const maxDaily = data ? Math.max(1, ...data.daily.map((d) => d.revenueCents)) : 1;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Revenue, orders, and catalog health at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!stats && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        {stats?.map((s) => (
          <Card key={s.key} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex size-8 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Revenue, last 30 days</CardTitle>
          <CardDescription>Daily revenue from paid, non-cancelled orders.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data ? (
            <Skeleton className="h-40 w-full" />
          ) : data.revenueCents === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No paid orders in this window yet.</p>
          ) : (
            <div className="flex h-40 items-end gap-[3px]">
              {data.daily.map((d) => (
                <div key={d.date} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                    style={{ height: `${Math.max(2, (d.revenueCents / maxDaily) * 100)}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                    {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {money(d.revenueCents)} · {d.orders} order{d.orders === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>By revenue from paid orders.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data ? (
              <Skeleton className="h-40 w-full" />
            ) : data.topProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Product</TableHead><TableHead>Qty sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProducts.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                      <TableCell className="text-right">{money(p.revenueCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
            <CardDescription>Across the order lifecycle.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {!data ? (
              <Skeleton className="h-8 w-full" />
            ) : Object.keys(data.ordersByStatus).length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              (Object.entries(data.ordersByStatus) as [OrderStatus, number][]).map(([status, count]) => (
                <Badge key={status} variant={statusVariant[status]} className="gap-1.5 py-1.5 text-sm font-normal">
                  {status} <span className="font-semibold">{count}</span>
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low stock</CardTitle>
            <AlertTriangle className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">{data ? data.lowStock : <Skeleton className="h-8 w-10" />}</div><p className="text-xs text-muted-foreground">At or below reorder threshold</p></CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Out of stock</CardTitle>
            <PackageX className="size-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">{data ? data.outOfStock : <Skeleton className="h-8 w-10" />}</div><p className="text-xs text-muted-foreground">Of {data?.productCount ?? '…'} active products</p></CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reviews</CardTitle>
            <Star className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{data ? (data.avgRating != null ? `${data.avgRating.toFixed(1)} ★` : '—') : <Skeleton className="h-8 w-10" />}</div>
            <p className="text-xs text-muted-foreground">{data ? `${data.reviewCount} published · ${data.pendingReviews} pending moderation` : '…'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
