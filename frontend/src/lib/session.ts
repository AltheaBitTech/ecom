import 'server-only';

import { decodeJwt } from 'jose';
import { cookies } from 'next/headers';

import { ACCESS_TOKEN_COOKIE } from './api';

/**
 * The signed-in staff member, as seen by the UI. Claims are DECODED (not
 * verified) here purely to render the correct navigation and hide actions the
 * user lacks permission for. The backend independently VERIFIES every token and
 * re-checks every permission — the UI is a convenience, never the gate.
 */
export interface StaffSession {
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
}

interface TokenClaims {
  sub?: string;
  tenant_id?: string;
  role?: string;
  permissions?: string[];
  type?: string;
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  let claims: TokenClaims;
  try {
    claims = decodeJwt(token) as TokenClaims;
  } catch {
    return null;
  }

  // Only staff tokens drive the admin. Customer tokens never do.
  if (claims.type === 'customer' || !claims.sub || !claims.tenant_id) return null;

  return {
    userId: claims.sub,
    tenantId: claims.tenant_id,
    role: claims.role ?? '',
    permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
  };
}

export function hasPermission(session: Pick<StaffSession, 'permissions'>, permission: string): boolean {
  return session.permissions.includes(permission);
}
