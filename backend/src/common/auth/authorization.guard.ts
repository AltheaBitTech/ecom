import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppException } from '../errors/app-exception';

import { AUTH_OPTIONAL_KEY, IS_PUBLIC_KEY, REQUIRED_PERMISSION_KEY } from './decorators';
import { isInternal, isStaff, tenantOf, type Principal } from './principal';

/**
 * Second layer of the guard chain. Two independent checks:
 *
 *   1. Tenant boundary — if the route has a `:tenantId` param, a tenant-bound
 *      principal's token tenant MUST match it, or the request is rejected with
 *      403 tenant_boundary_violation before any handler runs. This is defense in
 *      depth ON TOP of database RLS, not a replacement for it.
 *
 *   2. Permission — `@RequirePermission('products:write')` demands the key be in
 *      a staff caller's resolved permission set. Internal callers bypass;
 *      customers are always denied (they hold no permissions).
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { principal?: Principal }>();
    const principal = req.principal;
    if (!principal) {
      // Optional-auth routes legitimately run anonymously (e.g. guest checkout):
      // no principal, so nothing to authorize. Otherwise fail closed.
      const optional = this.reflector.getAllAndOverride<boolean>(AUTH_OPTIONAL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (optional) return true;
      throw AppException.unauthenticated();
    }

    this.assertTenantBoundary(req, principal);
    this.assertPermission(context, principal);
    return true;
  }

  private assertTenantBoundary(req: Request, principal: Principal): void {
    const pathTenant = (req.params as Record<string, string | undefined>)?.tenantId;
    if (!pathTenant) return; // route is not tenant-scoped
    if (isInternal(principal)) return; // trusted, cross-tenant

    if (tenantOf(principal) !== pathTenant) {
      throw AppException.tenantBoundary();
    }
  }

  private assertPermission(context: ExecutionContext, principal: Principal): void {
    const required = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return;
    if (isInternal(principal)) return;

    if (!isStaff(principal) || !principal.permissions.includes(required)) {
      throw AppException.permissionDenied(`Missing required permission: ${required}`);
    }
  }
}
