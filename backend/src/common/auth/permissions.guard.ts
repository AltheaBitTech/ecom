import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';
import type { AuthContext } from './request-context';

/** Deny by default: no @RequirePermissions and no @Public means the route is unreachable. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // No decorator at all → deny by default. @RequirePermissions() with no args → authenticated-only
    // (JwtAuthGuard already ran); a route needing a specific permission passes at least one.
    if (!required) return false;
    if (required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const granted = new Set(req.auth?.permissions ?? []);
    const ok = required.every((p) => granted.has(p));
    if (!ok) {
      throw new ForbiddenException('Missing required permission');
    }
    return true;
  }
}
