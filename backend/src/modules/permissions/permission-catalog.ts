/**
 * The e-commerce product's permission vocabulary — the SINGLE SOURCE OF TRUTH.
 *
 * ecom owns this list. The seed (`prisma/seed.ts`) upserts it into the local
 * `Permission` table and derives the platform-default Admin/Contributor/Reader
 * role templates from it (via `resolveDefaultRoles`), which provisioning clones
 * per tenant. There is no external identity service — this file IS the catalog.
 *
 * To add a capability, add its `resource:action` key here and re-seed — the
 * staff-&-roles admin screen (which reads the live catalog from ecom's own DB)
 * can immediately grant it. Keys are never removed automatically: pruning would
 * cascade to existing role grants and silently strip access, so it must be done
 * as a deliberate migration.
 *
 * Keys use the `resource:action` form matched by ecom's permission guard
 * (exact + wildcard). Every string passed to `@RequirePermission(...)` in this
 * codebase MUST appear here; the extra keys below are the declared vocabulary
 * for capabilities the admin surfaces manage (staff, roles, analytics, audit).
 */
export interface CatalogPermission {
  key: string;
  description: string;
}

export const PERMISSION_CATALOG: readonly CatalogPermission[] = [
  // Catalog — enforced today by CatalogController.
  { key: 'products:read', description: 'View products' },
  { key: 'products:write', description: 'Create/update/delete products' },
  // Orders — enforced today by OrdersController / ShippingController.
  { key: 'orders:read', description: 'View orders' },
  { key: 'orders:write', description: 'Manage order lifecycle and shipments' },
  // Flash sales — time-boxed price promotions on products.
  { key: 'promotions:read', description: 'View flash sales' },
  { key: 'promotions:write', description: 'Create/update/delete flash sales' },
  // Customers — read/write from the admin customers surface.
  { key: 'customers:read', description: 'View customers' },
  { key: 'customers:write', description: 'Suspend/reactivate or edit customers' },
  // Staff & roles — the merchant self-serve team-management surface.
  { key: 'staff:read', description: 'View staff members' },
  { key: 'staff:write', description: 'Invite/remove staff' },
  { key: 'staff:manage_roles', description: 'Create/edit roles and assignments' },
  // Store settings — enforced today by TenantsController / PaymentsController.
  { key: 'store_settings:read', description: 'View store settings' },
  { key: 'store_settings:write', description: 'Change store settings, theme, payments and shipping' },
  // Insight & governance.
  { key: 'analytics:read', description: 'View analytics' },
  { key: 'audit:read', description: 'View the tenant audit log' },
  { key: 'tenant:delete', description: 'Delete the tenant' },
] as const;
