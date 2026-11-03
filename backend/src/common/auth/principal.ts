/**
 * Who is making the request. Identity is minted by auth-rbac-service; this
 * service only verifies and models it.
 *
 *   staff    — a merchant/admin user. Carries a resolved permission set and is
 *              bound to exactly one tenant (the token's tenant_id).
 *   customer — a shopper, scoped to one store. No admin permissions, ever.
 *   internal — a trusted server-to-server caller (the product API key), used for
 *              provisioning and sync. Not tenant-bound.
 */
export type PrincipalKind = 'staff' | 'customer' | 'internal';

export interface StaffPrincipal {
  kind: 'staff';
  userId: string;
  productId: string;
  tenantId: string;
  role: string;
  permissions: string[];
  sessionId?: string;
}

export interface CustomerPrincipal {
  kind: 'customer';
  customerId: string;
  productId: string;
  tenantId: string;
}

export interface InternalPrincipal {
  kind: 'internal';
  productSlug: string;
}

export type Principal = StaffPrincipal | CustomerPrincipal | InternalPrincipal;

export function isStaff(p: Principal): p is StaffPrincipal {
  return p.kind === 'staff';
}
export function isCustomer(p: Principal): p is CustomerPrincipal {
  return p.kind === 'customer';
}
export function isInternal(p: Principal): p is InternalPrincipal {
  return p.kind === 'internal';
}

/** The tenant a principal is bound to, if any (internal callers span tenants). */
export function tenantOf(p: Principal): string | undefined {
  return p.kind === 'internal' ? undefined : p.tenantId;
}
