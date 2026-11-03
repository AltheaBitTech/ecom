import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { Entitlements, StoreConfig } from '@/lib/types';

/** Store settings — read-only overview in M1. Editing (theme, attribute schema,
 *  custom domain) lands with the write forms in M2. Custom-domain state reflects
 *  the tenant's plan entitlement, driven entirely by hasFeature on the backend. */
export default async function AdminSettings() {
  const session = await getStaffSession();

  if (!hasPermission(session!, 'store_settings:read')) {
    return (
      <div>
        <PageHeader title="Settings" />
        <EmptyState
          icon="🔒"
          title="You don't have access to settings"
          description="Store settings are managed by owners and managers."
        />
      </div>
    );
  }

  let settings: StoreConfig | null = null;
  let entitlements: Entitlements | null = null;
  try {
    [settings, entitlements] = await Promise.all([
      ecomApi.storeSettings(session!.tenantId),
      ecomApi.entitlements(session!.tenantId),
    ]);
  } catch {
    /* render what we can */
  }

  const attributeKeys = settings?.product_attribute_schema
    ? Object.keys((settings.product_attribute_schema as { properties?: Record<string, unknown> }).properties ?? {})
    : [];
  const customDomainsAllowed = entitlements?.features?.customDomains ?? false;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Store profile, attributes, and domain." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-ink-soft">Store profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Store name" value={settings?.store_name ?? '—'} />
            <Row label="Currency" value={settings?.currency ?? '—'} />
            <Row label="Locale" value={settings?.locale ?? '—'} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-ink-soft">Custom domain</h2>
          <div className="mt-4 text-sm">
            {customDomainsAllowed ? (
              settings?.custom_domain ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{settings.custom_domain}</span>
                  <Badge tone={settings.custom_domain_verified ? 'success' : 'warning'}>
                    {settings.custom_domain_verified ? 'verified' : 'pending DNS'}
                  </Badge>
                </div>
              ) : (
                <p className="text-ink-muted">No custom domain connected yet.</p>
              )
            ) : (
              <p className="text-ink-muted">
                Custom domains are available on the Pro plan and above.
              </p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-soft">Product attributes</h2>
            <Badge tone="neutral">{attributeKeys.length} defined</Badge>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            These are the fields your products carry beyond name and price — defined by you, with no
            category-specific code. A grocery store might add “expiry date”; an apparel store “size”.
          </p>
          {attributeKeys.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {attributeKeys.map((key) => (
                <span
                  key={key}
                  className="rounded-lg border border-line bg-paper-soft px-2.5 py-1 text-xs font-medium text-ink-soft"
                >
                  {key}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-faint">
              No custom attributes defined yet. Products will carry core fields only.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
