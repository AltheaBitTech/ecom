import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

import type { Principal, PrincipalKind } from './principal';

export const IS_PUBLIC_KEY = 'auth:public';
export const ALLOWED_KINDS_KEY = 'auth:kinds';
export const AUTH_OPTIONAL_KEY = 'auth:optional';
export const REQUIRED_PERMISSION_KEY = 'auth:permission';

/** No authentication — open endpoint (storefront reads, health, onboarding). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Authenticate IF a credential is present, otherwise allow through anonymously
 * (no principal). For endpoints a guest and a signed-in shopper both use — e.g.
 * checkout: a customer token attributes the order, its absence means a guest.
 * A present-but-invalid credential is still rejected.
 */
export const OptionalAuth = (...kinds: PrincipalKind[]): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(ALLOWED_KINDS_KEY, kinds.length ? kinds : (['customer'] as PrincipalKind[])),
    SetMetadata(AUTH_OPTIONAL_KEY, true),
  );

/**
 * Restrict which principal kinds may call this route. Defaults to staff-only
 * when unset. e.g. `@Auth('staff', 'internal')` or `@Auth('customer')`.
 */
export const Auth = (...kinds: PrincipalKind[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOWED_KINDS_KEY, kinds.length ? kinds : (['staff'] as PrincipalKind[]));

/** Shorthand for a trusted server-to-server (product API key) route. */
export const Internal = (): MethodDecorator & ClassDecorator => Auth('internal');

/**
 * Require a resource:action permission from the caller's resolved set. Checked
 * only for staff; internal callers bypass, customers are always denied.
 */
export const RequirePermission = (permission: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);

/** Inject the resolved principal into a handler parameter. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    const req = ctx.switchToHttp().getRequest();
    return req.principal as Principal;
  },
);
