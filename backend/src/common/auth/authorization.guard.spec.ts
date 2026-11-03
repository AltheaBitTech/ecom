import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppException } from '../errors/app-exception';

import { AuthorizationGuard } from './authorization.guard';
import { REQUIRED_PERMISSION_KEY } from './decorators';
import type { CustomerPrincipal, InternalPrincipal, Principal, StaffPrincipal } from './principal';

/**
 * Deterministic coverage of the HTTP authorization layer — the token tenant
 * boundary and permission check — with no database or network. Together with
 * test/isolation.e2e-spec.ts (the RLS layer) this is the isolation gate.
 */
const staff = (tenantId: string, permissions: string[] = []): StaffPrincipal => ({
  kind: 'staff',
  userId: 'u1',
  productId: 'ecommerce_saas',
  tenantId,
  role: 'Manager',
  permissions,
});
const customer = (tenantId: string): CustomerPrincipal => ({
  kind: 'customer',
  customerId: 'c1',
  productId: 'ecommerce_saas',
  tenantId,
});
const internal: InternalPrincipal = { kind: 'internal', productSlug: 'ecommerce_saas' };

function contextFor(principal: Principal, params: Record<string, string>): ExecutionContext {
  const req = { principal, params };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guardWith(requiredPermission?: string): AuthorizationGuard {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === REQUIRED_PERMISSION_KEY ? requiredPermission : undefined,
  } as unknown as Reflector;
  return new AuthorizationGuard(reflector);
}

describe('AuthorizationGuard — tenant boundary', () => {
  it('allows a staff principal into its own tenant', () => {
    const guard = guardWith();
    expect(guard.canActivate(contextFor(staff('tenant-a'), { tenantId: 'tenant-a' }))).toBe(true);
  });

  it('rejects a staff principal reaching another tenant', () => {
    const guard = guardWith();
    expect(() => guard.canActivate(contextFor(staff('tenant-a'), { tenantId: 'tenant-b' }))).toThrow(
      AppException,
    );
    try {
      guard.canActivate(contextFor(staff('tenant-a'), { tenantId: 'tenant-b' }));
    } catch (err) {
      expect((err as AppException).code).toBe('tenant_boundary_violation');
    }
  });

  it('rejects a customer reaching another store', () => {
    const guard = guardWith();
    expect(() =>
      guard.canActivate(contextFor(customer('tenant-a'), { tenantId: 'tenant-b' })),
    ).toThrow(AppException);
  });

  it('lets an internal (server-to-server) principal cross tenants', () => {
    const guard = guardWith();
    expect(guard.canActivate(contextFor(internal, { tenantId: 'tenant-b' }))).toBe(true);
  });
});

describe('AuthorizationGuard — permissions', () => {
  it('allows staff that holds the required permission', () => {
    const guard = guardWith('products:write');
    const ctx = contextFor(staff('tenant-a', ['products:write']), { tenantId: 'tenant-a' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies staff missing the required permission', () => {
    const guard = guardWith('products:write');
    const ctx = contextFor(staff('tenant-a', ['products:read']), { tenantId: 'tenant-a' });
    expect(() => guard.canActivate(ctx)).toThrow(AppException);
  });

  it('denies a customer any permissioned route', () => {
    const guard = guardWith('products:read');
    const ctx = contextFor(customer('tenant-a'), { tenantId: 'tenant-a' });
    expect(() => guard.canActivate(ctx)).toThrow(AppException);
  });

  it('lets an internal principal bypass the permission check', () => {
    const guard = guardWith('products:write');
    const ctx = contextFor(internal, { tenantId: 'tenant-a' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
