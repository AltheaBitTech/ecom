import { platformApi } from '@/lib/platform-api';
import type { PlatformOverview } from '@/lib/platform-types';
import { StatTile } from '@/components/platform/stat-tile';
import { SignupSparkline } from '@/components/platform/signup-sparkline';

export default async function PlatformOverviewPage() {
  const overview = await platformApi<PlatformOverview>('/platform/analytics/overview');

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Cross-tenant usage and revenue at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Tenants" value={overview.totalTenants} accent="teal" delayMs={0} />
        <StatTile label="Active subscriptions" value={overview.activeSubscriptions} accent="coral" delayMs={60} />
        <StatTile label="MRR" value={overview.mrrCents} format="inr" accent="amber" delayMs={120} />
        <StatTile label="GMV" value={overview.gmvCents} format="inr" accent="teal" delayMs={180} />
        <StatTile label="Signups (30d)" value={overview.signups30d.reduce((s, d) => s + d.count, 0)} accent="coral" delayMs={240} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SignupSparkline data={overview.signups30d} />
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tenants by status</p>
          <ul className="mt-3 grid gap-1.5">
            {Object.entries(overview.tenantsByStatus).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{status.replaceAll('_', ' ').toLowerCase()}</span>
                <span className="font-medium tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
        {overview.totalOrders.toLocaleString('en-IN')} orders placed across all tenants.
      </div>
    </div>
  );
}
