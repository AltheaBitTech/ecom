/**
 * The access-token claim shape the ecom backend signs and verifies locally, and
 * that the Next.js BFF decodes. Deliberately identity + role only — never
 * plan/billing/feature flags (those are resolved server-side per request).
 *
 * `product_id` is retained as a CONSTANT ('ecom') purely so the existing
 * frontend `session.ts` / middleware claim shape stays byte-identical after the
 * auth-rbac merge (plan §1.6); nothing branches on its value anymore.
 */
export type MembershipTypeClaim = 'staff' | 'customer';

/** The single product id emitted in every ecom token (see note above). */
export const ECOM_PRODUCT_ID = 'ecom';

export interface AccessTokenClaims {
  /** Global user id (staff) or customer id (shopper). */
  sub: string;
  product_id: string;
  tenant_id: string;
  role: string;
  permissions: string[];
  type: MembershipTypeClaim;
  /** Session id this access token belongs to (enables targeted revocation). */
  sid?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface IssueAccessTokenInput {
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
  type: MembershipTypeClaim;
  sessionId?: string;
  /** Defaults to the constant ECOM_PRODUCT_ID; callers never need to set this. */
  productId?: string;
}
