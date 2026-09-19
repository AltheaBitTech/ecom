'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  IndianRupee, ShoppingCart, Receipt, Users, ArrowRight, ExternalLink, TrendingUp, TrendingDown,
  Sparkles, PackagePlus, ShieldCheck, ClipboardList, AlertTriangle, Star, MapPin, Package, UserPlus, Megaphone,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import type { Analytics, AppNotification, ActivityItem, OrderStatus, TrendPoint } from '@/lib/types';

function money(cents: number, currency = 'INR') {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
}

function ago(iso: string) {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 90) return 'just now';
  const units: [number, string][] = [[60, 'minute'], [3600, 'hour'], [86400, 'day']];
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const [size, name] = units[i];
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const statusColor: Record<OrderStatus, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  SHIPPED: '#6366f1',
  FULFILLED: '#10b981',
  CANCELLED: '#ef4444',
};

/** Percentage change against the previous 30 days. Renders nothing when there's no basis. */
function Delta({ point, invert = false }: { point: TrendPoint; invert?: boolean }) {
  if (point.changePct === null) {
    return <span className="text-xs text-muted-foreground">vs. no activity last period</span>;
  }
  const up = point.changePct >= 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
      <Icon className="size-3.5" />
      {up ? '+' : ''}{point.changePct.toFixed(1)}%
      <span className="font-normal text-muted-foreground">vs. last 30 days</span>
    </span>
  );
}

/** Tiny filled trend line behind a stat. Purely decorative context — the number is the message. */
function Sparkline({ data, dataKey, color }: { data: Analytics['daily']; dataKey: string; color: string }) {
  const id = `spark-${dataKey}`;
  return (
    <div className="h-12 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const activityIcon = { order: ShoppingCart, customer: UserPlus, review: Star } as const;
const activityTint = {
  order: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  customer: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  review: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const;

export default function AdminOverviewPage() {
  const { user, tenant, hasPermission } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const canViewOrders = hasPermission(PERMISSIONS.ORDERS_VIEW);

  useEffect(() => {
    if (canViewOrders) api<Analytics>('/storefront/admin/analytics').then(setAnalytics).catch(() => {});
    api<{ items: AppNotification[] }>('/notifications').then((d) => setNotifications(d.items.slice(0, 4))).catch(() => {});
  }, [canViewOrders]);

  const setup = analytics?.setup;
  const todo = setup && [
    setup.publishedCount === 0 && { href: '/admin/products', label: 'Publish your first product', detail: 'Nothing is visible on the storefront until a product is published.' },
    setup.publishedCount > 0 && setup.sellableCount === 0 && { href: '/admin/inventory', label: 'Add stock to your products', detail: `All ${setup.publishedCount} published product${setup.publishedCount === 1 ? '' : 's'} show as out of stock, so nothing can be bought.` },
    setup.publishedCount > 0 && setup.sellableCount > 0 && setup.withoutImages > 0 && { href: '/admin/products', label: 'Add product photos', detail: `${setup.withoutImages} published product${setup.withoutImages === 1 ? '' : 's'} still show a placeholder image.` },
    !setup.contactSet && { href: '/admin/storefront', label: 'Add store contact details', detail: 'Shoppers see no email or phone to reach you with.' },
    !setup.deliverySet && { href: '/admin/storefront', label: 'Set up delivery', detail: 'Confirm your delivery charge, pickup option, and delivery information.' },
  ].filter((x): x is { href: string; label: string; detail: string } => !!x);

  const stats = analytics && [
    { key: 'revenue', label: 'Revenue', value: money(analytics.trend.revenue.current), point: analytics.trend.revenue, icon: IndianRupee, dataKey: 'revenueCents', color: '#8b5cf6', tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { key: 'orders', label: 'Paid orders', value: String(analytics.trend.orders.current), point: analytics.trend.orders, icon: ShoppingCart, dataKey: 'orders', color: '#3b82f6', tint: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { key: 'customers', label: 'New customers', value: String(analytics.trend.customers.current), point: analytics.trend.customers, icon: Users, dataKey: 'customers', color: '#10b981', tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { key: 'aov', label: 'Avg order value', value: money(analytics.trend.avgOrderValue.current), point: analytics.trend.avgOrderValue, icon: Receipt, dataKey: 'revenueCents', color: '#f59e0b', tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ];

  const segments = analytics && [
    { name: 'Repeat buyers', value: analytics.customerSegments.repeat, color: '#8b5cf6' },
    { name: 'One order', value: analytics.customerSegments.single, color: '#3b82f6' },
    { name: 'No orders yet', value: analytics.customerSegments.neverOrdered, color: '#94a3b8' },
  ];
  const segmentTotal = segments?.reduce((n, s) => n + s.value, 0) ?? 0;
  const regionMax = Math.max(1, ...(analytics?.salesByRegion.map((r) => r.revenueCents) ?? [1]));

  return (
    <div className="grid gap-5">
      {/* Hero */}
      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-violet-500/15 via-primary/5 to-transparent">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 right-32 size-56 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
        <CardContent className="relative flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <p className="text-sm text-muted-foreground">{greeting()}{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Here&apos;s what&apos;s happening with {tenant?.name ?? 'your business'} today.</h1>
            <p className="mt-2 text-muted-foreground">Track performance, stay on top of your orders, and see where growth is coming from.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button nativeButton={false} render={<Link href="/admin/orders" />}>
                <ClipboardList className="size-4" />
                Manage orders
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/store" target="_blank" rel="noreferrer" />}>
                <ExternalLink className="size-4" />
                Visit storefront
              </Button>
            </div>
          </div>

          {analytics && (
            <div className="w-full max-w-xs rounded-2xl border bg-background/70 p-5 shadow-sm backdrop-blur">
              <p className="text-xs text-muted-foreground">Revenue, last 30 days</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{money(analytics.trend.revenue.current)}</p>
              <div className="mt-1"><Delta point={analytics.trend.revenue} /></div>
              <Sparkline data={analytics.daily} dataKey="revenueCents" color="#8b5cf6" />
            </div>
          )}
        </CardContent>
      </Card>

      {!canViewOrders ? (
        <p className="text-sm text-muted-foreground">Ask an admin for order access to see the business snapshot.</p>
      ) : (
        <>
          {todo && todo.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-500" />
                  Finish setting up your store
                </CardTitle>
                <CardDescription>
                  {setup && setup.sellableCount === 0
                    ? 'Customers can browse your storefront, but nothing can be ordered yet.'
                    : 'A few things are still missing from your storefront.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1">
                {todo.map((step) => (
                  <Link key={step.label} href={step.href} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 text-sm transition-colors hover:bg-amber-500/10">
                    <span>
                      <span className="font-medium">{step.label}</span>
                      <span className="block text-xs text-muted-foreground">{step.detail}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 opacity-60" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* Main column */}
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {!stats && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
                {stats?.map((s) => (
                  <Card key={s.key} className="overflow-hidden border-border/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                      <div className={`flex size-8 items-center justify-center rounded-lg ${s.tint}`}>
                        <s.icon className="size-4" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-0">
                      <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
                      <div className="mt-1"><Delta point={s.point} /></div>
                    </CardContent>
                    {analytics && <Sparkline data={analytics.daily} dataKey={s.dataKey} color={s.color} />}
                  </Card>
                ))}
              </div>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle>Revenue overview</CardTitle>
                  <CardDescription>Daily revenue from paid, non-cancelled orders over the last 30 days.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!analytics ? (
                    <Skeleton className="h-64 w-full" />
                  ) : analytics.trend.revenue.current === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">No paid orders in this window yet.</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.daily} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                          <defs>
                            <linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: 'currentColor' }}
                            className="text-muted-foreground"
                            tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            minTickGap={28}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={64}
                            tick={{ fontSize: 11, fill: 'currentColor' }}
                            className="text-muted-foreground"
                            tickFormatter={(v: number) => money(v)}
                          />
                          <Tooltip
                            cursor={{ stroke: '#8b5cf6', strokeDasharray: 4 }}
                            contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--popover)', fontSize: 12 }}
                            labelFormatter={(d) => new Date(String(d)).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                            formatter={(v, _n, item) => {
                              const orders = Number((item?.payload as { orders?: number } | undefined)?.orders ?? 0);
                              return [`${money(Number(v ?? 0))} · ${orders} order${orders === 1 ? '' : 's'}`, 'Revenue'];
                            }}
                          />
                          <Area type="monotone" dataKey="revenueCents" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#revenue-area)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Top products</CardTitle>
                      <CardDescription>By revenue from paid orders.</CardDescription>
                    </div>
                    <Button variant="link" size="sm" className="px-0" nativeButton={false} render={<Link href="/admin/analytics" />}>
                      View all <ArrowRight className="size-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!analytics ? (
                      <Skeleton className="h-48 w-full" />
                    ) : analytics.topProducts.length === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">No products sold yet.</p>
                    ) : (
                      <ol className="grid gap-1">
                        {analytics.topProducts.map((p, i) => (
                          <li key={p.productId} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent">
                            <span className="w-4 text-sm text-muted-foreground">{i + 1}.</span>
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Package className="size-4 text-muted-foreground" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{p.name}</span>
                              <span className="block text-xs text-muted-foreground">{p.quantity} sold</span>
                            </span>
                            <span className="text-sm font-semibold">{money(p.revenueCents)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle>Customer mix</CardTitle>
                    <CardDescription>How many of your customers come back.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!analytics ? (
                      <Skeleton className="h-48 w-full" />
                    ) : segmentTotal === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">No customers yet.</p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="relative h-36 w-36 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={segments ?? []} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                                {segments!.map((s) => <Cell key={s.name} fill={s.color} />)}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--popover)', fontSize: 12 }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-semibold">{segmentTotal.toLocaleString()}</span>
                            <span className="text-[11px] text-muted-foreground">customers</span>
                          </div>
                        </div>
                        <ul className="grid flex-1 gap-2.5">
                          {segments!.map((s) => (
                            <li key={s.name} className="flex items-center gap-2 text-sm">
                              <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                              <span className="flex-1 text-muted-foreground">{s.name}</span>
                              <span className="font-medium">{s.value}</span>
                              <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((s.value / segmentTotal) * 100)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" />Sales by region</CardTitle>
                  <CardDescription>Revenue by the delivery state on paid orders.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!analytics ? (
                    <Skeleton className="h-32 w-full" />
                  ) : analytics.salesByRegion.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">No delivered orders to map yet.</p>
                  ) : (
                    <ul className="grid gap-3">
                      {analytics.salesByRegion.map((r) => (
                        <li key={r.region} className="grid gap-1.5">
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="font-medium">{r.region}</span>
                            <span className="text-muted-foreground">{money(r.revenueCents)} · {r.orders} order{r.orders === 1 ? '' : 's'}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(3, (r.revenueCents / regionMax) * 100)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right rail */}
            <div className="grid content-start gap-5">
              <Card className="border-border/60">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Recent activity</CardTitle>
                  <Button variant="link" size="sm" className="px-0" nativeButton={false} render={<Link href="/admin/orders" />}>
                    View all <ArrowRight className="size-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {!analytics ? (
                    <Skeleton className="h-56 w-full" />
                  ) : analytics.activity.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nothing yet. Orders, customers, and reviews show up here.</p>
                  ) : (
                    <ul className="grid gap-1">
                      {analytics.activity.map((a: ActivityItem) => {
                        const Icon = activityIcon[a.kind];
                        return (
                          <li key={`${a.kind}-${a.id}`}>
                            <Link href={a.link} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${activityTint[a.kind]}`}>
                                <Icon className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{a.title}</span>
                                <span className="block text-xs text-muted-foreground">{a.detail}</span>
                                <span className="block text-[11px] text-muted-foreground/70">{ago(a.at)}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Notifications</CardTitle>
                  <CardDescription>Alerts for you and your team.</CardDescription>
                </CardHeader>
                <CardContent>
                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
                  ) : (
                    <ul className="grid gap-1">
                      {notifications.map((n) => (
                        <li key={n.id}>
                          <Link href={n.link ?? '/admin'} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: n.readAt ? 'var(--muted-foreground)' : '#8b5cf6' }} aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm ${n.readAt ? 'text-muted-foreground' : 'font-medium'}`}>{n.title}</span>
                              <span className="block text-[11px] text-muted-foreground/70">{ago(n.createdAt)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Orders by status</CardTitle>
                  <CardDescription>Across every order you&apos;ve taken.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!analytics ? (
                    <Skeleton className="h-24 w-full" />
                  ) : Object.keys(analytics.ordersByStatus).length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
                  ) : (
                    <ul className="grid gap-2">
                      {(Object.entries(analytics.ordersByStatus) as [OrderStatus, number][]).map(([status, count]) => (
                        <li key={status} className="flex items-center gap-2 text-sm">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: statusColor[status] }} />
                          <span className="flex-1 capitalize text-muted-foreground">{status.toLowerCase()}</span>
                          <span className="font-medium">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-0 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Sparkles className="size-4" />
                    Quick actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1">
                  {[
                    { href: '/admin/products', label: 'Add a product', icon: PackagePlus },
                    { href: '/admin/marketing', label: 'Send a campaign', icon: Megaphone },
                    { href: '/admin/storefront', label: 'Create an offer', icon: Sparkles },
                    { href: '/admin/roles', label: 'Manage roles', icon: ShieldCheck },
                  ].map((a) => (
                    <Link key={a.href} href={a.href} className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-white/90 transition-colors hover:bg-white/10">
                      <span className="flex items-center gap-2"><a.icon className="size-4" />{a.label}</span>
                      <ArrowRight className="size-3.5 opacity-60" />
                    </Link>
                  ))}
                </CardContent>
              </Card>

              {analytics && (analytics.pendingReviews > 0 || analytics.lowStock > 0 || analytics.outOfStock > 0) && (
                <Card className="border-border/60">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Needs attention</CardTitle></CardHeader>
                  <CardContent className="grid gap-2 text-sm">
                    {analytics.pendingReviews > 0 && (
                      <Link href="/admin/storefront" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
                        <span className="flex items-center gap-2"><Star className="size-4 text-amber-500" />Reviews to moderate</span>
                        <Badge variant="secondary">{analytics.pendingReviews}</Badge>
                      </Link>
                    )}
                    {analytics.lowStock > 0 && (
                      <Link href="/admin/inventory" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
                        <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" />Low on stock</span>
                        <Badge variant="secondary">{analytics.lowStock}</Badge>
                      </Link>
                    )}
                    {analytics.outOfStock > 0 && (
                      <Link href="/admin/inventory" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
                        <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-rose-500" />Out of stock</span>
                        <Badge variant="destructive">{analytics.outOfStock}</Badge>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
