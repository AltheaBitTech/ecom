import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthContext } from './request-context';

/** Reads the authenticated user set by JwtAuthGuard onto the request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest();
  return req.auth as AuthContext;
});
