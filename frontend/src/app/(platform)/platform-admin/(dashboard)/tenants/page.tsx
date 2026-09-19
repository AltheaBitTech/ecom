import Link from 'next/link';
import { platformApi } from '@/lib/platform-api';
import type { PlatformTenantsPage } from '@/lib/platform-types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TenantStatusBadge } from '@/components/platform/tenant-status-badge';
import { TenantRowActions } from '@/components/platform/tenant-row-actions';

const PAGE_SIZE = 25;

function formatInr(cents: number) {
  return `₹${(cents / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default async function PlatformTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { data, total, pageSize } = await platformApi<PlatformTenantsPage>(
    `/platform/analytics/tenants?page=${page}&pageSize=${PAGE_SIZE}`,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Tenants</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString('en-IN')} total workspaces.</p>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">GMV</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.slug}</div>
                </TableCell>
                <TableCell>
                  <TenantStatusBadge status={t.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.planName ? `${t.planName} · ${t.subscriptionStatus?.toLowerCase()}` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{t.orderCount.toLocaleString('en-IN')}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInr(t.gmvCents)}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(t.createdAt).toLocaleDateString('en-IN')}</TableCell>
                <TableCell>
                  <TenantRowActions id={t.id} status={t.status} />
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No tenants found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              nativeButton={false}
              render={<Link href={`/platform-admin/tenants?page=${page - 1}`} />}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              nativeButton={false}
              render={<Link href={`/platform-admin/tenants?page=${page + 1}`} />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
