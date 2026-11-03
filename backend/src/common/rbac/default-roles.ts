/**
 * Platform-default role templates.
 *
 * ecom automatically gets the same three baseline roles with ZERO
 * category-specific code. A role's concrete permission set is DERIVED from the
 * permission catalog (src/modules/permissions/permission-catalog.ts) by matching
 * the action verb of each `resource:action` key, so changing the catalog reshapes
 * the roles with no code change. Tenants may layer additional custom roles on top;
 * these three are the guaranteed baseline.
 *
 * Ported verbatim from the former auth-rbac-service (pure, no dependencies).
 */

/** Actions that a read-only Reader (and everyone above) may perform. */
const READ_ACTIONS = new Set(['read', 'list', 'view', 'get']);

/** Write actions a Contributor may perform on top of reads. Anything NOT in
 *  either set (delete, manage_roles, publish, custom verbs…) is Admin-only by
 *  default — the safe choice, since an unknown verb is treated as privileged. */
const WRITE_ACTIONS = new Set(['write', 'create', 'update', 'edit', 'upsert']);

/** The action half of a `resource:action` key (`products:read` -> `read`). */
export function actionOf(permissionKey: string): string {
  const idx = permissionKey.indexOf(':');
  return idx === -1 ? permissionKey : permissionKey.slice(idx + 1);
}

const isRead = (key: string): boolean => READ_ACTIONS.has(actionOf(key));
const isWrite = (key: string): boolean => WRITE_ACTIONS.has(actionOf(key));

export interface DefaultRoleTemplate {
  name: string;
  description: string;
  /** The tenant founder is auto-granted the grant-on-provision role. Exactly
   *  one default carries this flag. */
  grantOnProvision: boolean;
  /** A tenant must always keep ≥1 active holder of a protected role. */
  isProtected: boolean;
  /** Predicate: does this role receive the given catalog permission key? */
  selects: (permissionKey: string) => boolean;
}

export const DEFAULT_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    name: 'Admin',
    description: 'Full access to everything in this store.',
    grantOnProvision: true,
    isProtected: true,
    selects: () => true,
  },
  {
    name: 'Contributor',
    description: 'Read and edit day-to-day resources; no administrative actions.',
    grantOnProvision: false,
    isProtected: false,
    selects: (key) => isRead(key) || isWrite(key),
  },
  {
    name: 'Reader',
    description: 'Read-only access.',
    grantOnProvision: false,
    isProtected: false,
    selects: (key) => isRead(key),
  },
];

export interface ResolvedDefaultRole {
  name: string;
  description: string;
  grantOnProvision: boolean;
  isProtected: boolean;
  permissionKeys: string[];
}

/**
 * Materialize the default role templates against the permission catalog,
 * resolving each role's concrete permission keys. Pure — callers (seed script
 * and tenant-provisioning service) persist the result.
 */
export function resolveDefaultRoles(catalogKeys: string[]): ResolvedDefaultRole[] {
  return DEFAULT_ROLE_TEMPLATES.map((template) => ({
    name: template.name,
    description: template.description,
    grantOnProvision: template.grantOnProvision,
    isProtected: template.isProtected,
    permissionKeys: catalogKeys.filter((key) => template.selects(key)),
  }));
}
