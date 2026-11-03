import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppConfig } from '../config/app-config';
import { AppException } from '../errors/app-exception';
import { ECOM_PRODUCT_ID } from '../jwt/jwt.types';
import { setCurrentPrincipal } from '../observability/request-context';

import { ALLOWED_KINDS_KEY, AUTH_OPTIONAL_KEY, IS_PUBLIC_KEY } from './decorators';
import { JwksService } from './jwks.service';
import { isInternal, isStaff, type Principal, type PrincipalKind, tenantOf } from './principal';

/**
 * Resolves the caller into a `Principal` and attaches it to the request, or
 * rejects. Credential resolution:
 *   - `X-Internal-Key` matching the internal API key  -> internal principal
 *   - `Authorization: Bearer <jwt>` verified in-process -> staff | customer
 * The route's `@Auth(...)` list (default staff-only) then decides whether that
 * kind is acceptable. `@Public()` skips the whole guard.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwks: JwksService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowed =
      this.reflector.getAllAndOverride<PrincipalKind[]>(ALLOWED_KINDS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? (['staff'] as PrincipalKind[]);

    const optional = this.reflector.getAllAndOverride<boolean>(AUTH_OPTIONAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<Request>();

    // Optional auth: no credential → proceed anonymously (no principal attached).
    if (optional && !this.hasCredential(req)) return true;

    const principal = await this.resolve(req, allowed);

    if (!allowed.includes(principal.kind)) {
      throw AppException.permissionDenied(`This endpoint does not accept ${principal.kind} credentials`);
    }

    (req as Request & { principal: Principal }).principal = principal;
    // Attribute every log line / audit row / response envelope to this caller.
    setCurrentPrincipal({
      kind: principal.kind,
      id: isInternal(principal)
        ? principal.productSlug
        : isStaff(principal)
          ? principal.userId
          : principal.customerId,
      tenant_id: tenantOf(principal),
    });
    return true;
  }

  /** True if the request carries any recognised credential. */
  private hasCredential(req: Request): boolean {
    return Boolean(req.header('x-internal-key') || req.header('authorization')?.startsWith('Bearer '));
  }

  private async resolve(req: Request, allowed: PrincipalKind[]): Promise<Principal> {
    // Server-to-server: constant-time-ish check against the shared internal key.
    const internalKey = req.header('x-internal-key');
    if (internalKey) {
      if (internalKey !== this.config.internalApiKey) {
        throw AppException.unauthenticated('Invalid internal key');
      }
      return { kind: 'internal', productSlug: ECOM_PRODUCT_ID };
    }

    const authz = req.header('authorization');
    if (authz?.startsWith('Bearer ')) {
      const token = authz.slice('Bearer '.length).trim();
      return this.jwks.verify(token);
    }

    const wantsInternal = allowed.length === 1 && allowed[0] === 'internal';
    throw AppException.unauthenticated(
      wantsInternal ? 'Missing internal key' : 'Missing bearer token',
    );
  }
}
